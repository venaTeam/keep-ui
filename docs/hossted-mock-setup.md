# Running keep-ui against the Hossted mock server

This is the minimum set of branches and steps to go from a clean clone of
each repo to a working setup: the Hossted mock server firing alert events,
Keep's pipeline ingesting them, and keep-ui's Feed table displaying them
with the Hossted widget column.

## Branches

| Repo | Branch | What it adds |
|---|---|---|
| `keep-ui` | `feat/hossted-integration-setup` | `@hossted/keep-integration` widget wiring + fixes the Feed table so it actually loads alerts |
| `keep-api-gateway` | `fix/alert-field-mapping-casing` | Fixes CEL/facet field mapping for camelCase alert fields, merges alembic heads |
| `keep-event-handler` | `feat/prometheus-provider-and-port-fix` | Adds the `prometheus_provider` the consumer needs to process mock alerts, moves a colliding Redis port |
| `hossted-survey-api` | `feat/keep-backend-dev-routing` | Routes `keep-backend-dev` to the host backend, seeds a dev API key |

None of this requires Keep's own `docker-compose.dev.yml` stack (the
`keep-backend-dev`/`keep-frontend-dev` containers) — this setup runs
`keep-api-gateway` and `keep-ui` as plain host processes instead.

## Steps

1. **Clone each repo at its branch above.**

2. **Infra containers** (from `keep-event-handler`):
   ```
   docker compose -f docker-compose.infra.yml up -d
   ```
   This brings up Postgres, Kafka/Zookeeper, the infra Redis, and the
   websocket server.

3. **keep-api-gateway** (host process):
   ```
   poetry install
   poetry run alembic upgrade head
   poetry run gunicorn src.main:get_app --bind 0.0.0.0:8080 \
     --workers 1 -k uvicorn.workers.UvicornWorker -c src/config/config.py
   ```
   Needs `DATABASE_CONNECTION_STRING=postgresql://keep:keep@localhost:5432/keep`
   and `AUTH_TYPE=NOAUTH` in its env.

4. **keep-event-handler** (host process):
   ```
   poetry install
   poetry run python -m src.consumer_main
   ```

5. **hossted-survey-api** (mock alert generator + mock Hossted analysis
   endpoint):
   ```
   docker compose up -d --build
   ```
   `KEEP_API_URL`/`KEEP_API_KEY` default to `http://keep-backend-dev:8080`
   / `dev-noauth` (see `data/settings.json`), which works against the
   NOAUTH backend from step 3 with no further setup.

   This same server also stands in for the real local Hossted platform —
   its `/api/integrations` route (not `/api/v1/integrations`, that path is
   only for mapping CRUD) returns a canned analysis response, gated by a
   per-integration bearer token that's randomized on first boot. Fix it to
   a known value so `.env` can hardcode it:
   ```
   curl -X POST http://localhost:4400/api/v1/integration-mappings \
     -H 'Content-Type: application/json' \
     -d '{"integration":"keep","tokenValue":"mock-keep-token","payloadIdField":"fingerprint"}'
   ```

6. **keep-ui**:
   ```
   npm install
   docker compose -f docker-compose.hossted.yml up -d   # Hossted proxy's Redis cache
   npm run dev
   ```
   `.env`'s `HOSSTED_UPSTREAM_URL`/`HOSSTED_UPSTREAM_TOKEN` already point at
   the mock server from step 5 (`http://localhost:4400/api/integrations` /
   `mock-keep-token`) — **not** `http://localhost:7007/api/v1/integrations`
   (that's the real local Hossted platform, hkb_rag; only switch to it
   deliberately, it's a separate objective from testing against the mock).
   Everything else in `.env` is already set for this local setup.

## Verifying

Fire a test alert and confirm it's actually reaching the backend keep-ui
reads from:
```
curl -X POST http://localhost:8080/alerts/event/prometheus \
  -H 'Content-Type: application/json' -H 'x-api-key: dev-noauth' \
  -d '{"fingerprint":"smoke-test","labels":{"alertname":"smoke-test","severity":"critical"},"annotations":{"summary":"smoke test"},"status":"firing","startsAt":"2026-01-01T00:00:00Z","endsAt":"0001-01-01T00:00:00Z","generatorURL":"http://test"}'
```
should return `202 Accepted`, and the alert should appear in keep-ui at
`http://localhost:3000/alerts/feed` within a couple of seconds.

Confirm the Hossted widget is talking to the mock server (not the real
platform, and with a token the mock actually accepts):
```
./scripts/verify-hossted-mock.sh
```
`OK: mock server responded with a usable summary/response.` means the
exact request `HosstedButton` sends — through `app/api/hossted/route.ts`,
with the `.env` URL and token — round-trips correctly. It fails loudly if
`HOSSTED_UPSTREAM_URL` points at the real platform instead of the mock, or
if the token doesn't match the mock's "keep" integration mapping (with the
fix for the latter printed in the failure message).

To see it rendered: open a debugged alert's row in the Feed and click its
"Hossted" column — it should show a filled-in icon (not stuck loading) with
`Analysis complete for this alert.` in the tooltip, and the alert's sidebar
should show the same text under "Hossted".
