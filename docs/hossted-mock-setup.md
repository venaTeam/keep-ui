# Running keep-ui against the Hossted mock server

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
   This brings up Postgres/Kafka/Redis/Pusher, seeds `.env` in `keep-api-gateway`/`keep-event-handler` from their `env.example` if missing, runs `poetry install`/`npm install` if needed, runs migrations, starts `keep-api-gateway`, `keep-event-handler`, `keep-ui`, and the `hossted-survey-api` mock server (with its own Redis cache), then waits for all of them to become healthy. Logs land in `keep-ui/.dev-run/`.

   To tear everything down: `./scripts/dev-up.sh --down`.

3. **Open `http://localhost:3000/alerts/feed`.** NOAUTH signs you in    automatically.

## Verifying

Fire a test alert and confirm it's actually reaching the backend keep-ui reads from:
```
curl -X POST http://localhost:8080/alerts/event/prometheus \
  -H 'Content-Type: application/json' -H 'x-api-key: dev-noauth' \
  -d '{"fingerprint":"smoke-test","labels":{"alertname":"smoke-test","severity":"critical"},"annotations":{"summary":"smoke test"},"status":"firing","startsAt":"2026-01-01T00:00:00Z","endsAt":"0001-01-01T00:00:00Z","generatorURL":"http://test"}'
```
should return `202 Accepted`, and the alert should appear in keep-ui at `http://localhost:3000/alerts/feed` within a couple of seconds.

Confirm the Hossted widget is talking to the mock server (not the real platform, and with a token the mock actually accepts):
```
./scripts/verify-hossted-mock.sh
```
`OK: mock server responded with a usable summary/response.` means the exact request `HosstedButton` sends through `app/api/hossted/route.ts`, with the `.env` URL and token.

To see it rendered: open an alert's row in the Feed and click its "Send to Hossted" Button in the "Hossted" column — it should show a green icon with `Analysis complete for this alert.` in the tooltip, and the alert's sidebar should show text under the "Hossted" field.
