# Running keep-ui against the Hossted mock server

The minimum steps to go from a clean clone of each repo to a working setup:
the Hossted mock server firing alert events, Keep's pipeline ingesting them,
and keep-ui's Feed table displaying them with the Hossted widget column.

None of this requires Keep's own `docker-compose.dev.yml` stack (the
`keep-backend-dev`/`keep-frontend-dev` containers) — `keep-api-gateway` and
`keep-event-handler` run as plain host processes, driven by
`scripts/dev-up.sh` below.

## Branches

| Repo | Branch | What it adds |
|---|---|---|
| `keep-ui` | `feat/hossted-integration-setup` | `@hossted/keep-integration` widget wiring, fixes the Feed table so it actually loads alerts, `scripts/dev-up.sh`/`verify-hossted-mock.sh` |
| `keep-api-gateway` | `fix/alert-field-mapping-casing` | Fixes CEL/facet field mapping for camelCase alert fields, merges alembic heads, adds `env.example` |
| `keep-event-handler` | `feat/prometheus-provider-and-port-fix` | Adds the `prometheus_provider` the consumer needs to process mock alerts, moves a colliding Redis port, adds `env.example` |
| `hossted-survey-api` | `feat/keep-backend-dev-routing` | Routes `keep-backend-dev` to the host backend, seeds a dev API key, fixes the mock "keep" integration token to a known value |

## Steps

1. **Clone all four repos at their branches above, as siblings under one directory:**
   ```
   mkdir keep-dev && cd keep-dev
   git clone --branch feat/hossted-integration-setup      <keep-ui remote>            keep-ui
   git clone --branch fix/alert-field-mapping-casing       <keep-api-gateway remote>   keep-api-gateway
   git clone --branch feat/prometheus-provider-and-port-fix <keep-event-handler remote> keep-event-handler
   git clone --branch feat/keep-backend-dev-routing        <hossted-survey-api remote> hossted-survey-api
   ```

2. **Run the setup script from `keep-ui`:**
   ```
   cd keep-ui
   ./scripts/dev-up.sh
   ```
   This brings up Postgres/Kafka/Redis/Pusher, seeds `.env` in
   `keep-api-gateway`/`keep-event-handler` from their `env.example` if
   missing, runs `poetry install`/`npm install` if needed, runs migrations,
   starts `keep-api-gateway`, `keep-event-handler`, `keep-ui`, and the
   `hossted-survey-api` mock server (with its own Redis cache), then waits
   for all of them to become healthy. Logs land in `keep-ui/.dev-run/`.

   To tear everything down: `./scripts/dev-up.sh --down`.

3. **Open `http://localhost:3000/alerts/feed`.** NOAUTH signs you in
   automatically.

That's it — no manual `.env` editing, no manual token-syncing curl call (the
mock server's default "keep" integration token is fixed, not randomized, so
it already matches keep-ui's committed `HOSSTED_UPSTREAM_TOKEN`).

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
`OK: mock server responded with a usable summary/response.` means the exact
request `HosstedButton` sends — through `app/api/hossted/route.ts`, with the
`.env` URL and token — round-trips correctly. It fails loudly if
`HOSSTED_UPSTREAM_URL` points at the real platform (`.env`'s default is the
mock, `http://localhost:4400/api/integrations` — **not**
`http://localhost:7007/api/v1/integrations`, that's the real local Hossted
platform, hkb_rag; only switch to it deliberately, it's a separate objective
from testing against the mock) or if the token doesn't match the mock's
"keep" integration mapping.

To see it rendered: open an alert's row in the Feed and click its "Hossted"
column — it should show a filled-in icon (not stuck loading) with `Analysis
complete for this alert.` in the tooltip, and the alert's sidebar should show
the same text under "Hossted".

## Restarting after changing `.env`

Next.js (and the Python services) only read `.env` at process startup — an
edit doesn't take effect until the process restarts. `./scripts/dev-up.sh
--down` followed by `./scripts/dev-up.sh` again is the reliable way to pick
up a `.env` change; killing by port number isn't enough; a supervisor or a
leftover process on a different PID can end up still serving the old
values.
