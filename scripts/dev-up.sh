#!/usr/bin/env bash
# Brings up the full local stack for testing keep-ui against the Hossted mock
# server: infra (Postgres/Kafka/Redis/Pusher) + keep-api-gateway +
# keep-event-handler + keep-ui + hossted-survey-api (the mock alert
# generator, which also stands in for the real Hossted analysis platform).
# See docs/hossted-mock-setup.md for the full picture.
#
# Assumes the sibling layout documented there:
#   <root>/keep-ui                 (this repo)
#   <root>/keep-api-gateway
#   <root>/keep-event-handler
#   <root>/hossted-survey-api
#
#   ./scripts/dev-up.sh [--root <dir>]   # start everything (reuses Postgres data)
#   ./scripts/dev-up.sh --down           # stop everything this script started
#
# --root is the directory CONTAINING the sibling repos above (default: this
# repo's parent directory). Logs + PIDs land in <this repo>/.dev-run/.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DOWN=0; ROOT_ARG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --down)    DOWN=1 ;;
    --root)    shift; ROOT_ARG="${1:-}"; [[ -z "$ROOT_ARG" ]] && { echo "--root needs a path" >&2; exit 2; } ;;
    --root=*)  ROOT_ARG="${1#--root=}" ;;
    *) echo "unknown flag: $1 (use --root <path> / --down)" >&2; exit 2 ;;
  esac
  shift
done

ROOT="${ROOT_ARG:-$(cd "$UI_DIR/.." && pwd)}"
GATEWAY="$ROOT/keep-api-gateway"
HANDLER="$ROOT/keep-event-handler"
MOCK="$ROOT/hossted-survey-api"

for d in "$GATEWAY" "$HANDLER" "$MOCK"; do
  [[ -d "$d" ]] || { echo "Missing sibling repo: $d (pass --root <dir-containing-the-repos>)" >&2; exit 1; }
done

INFRA="$HANDLER/docker-compose.infra.yml"
LOGDIR="$UI_DIR/.dev-run"
PIDFILE="$LOGDIR/pids.txt"
mkdir -p "$LOGDIR"

stop_services() {  # kill the whole process GROUP each service was started in
  # (start_svc launches under `setsid`, so $pid is also its process group id) —
  # a plain `kill $pid` only hits e.g. `npm`, not the `next dev`/`next-server`
  # children it forked, which npm doesn't forward signals to.
  if [[ -f "$PIDFILE" ]]; then
    while read -r pid; do [[ -n "$pid" ]] && kill -- "-$pid" 2>/dev/null || true; done < "$PIDFILE"
    rm -f "$PIDFILE"
  fi
}

if [[ "$DOWN" == "1" ]]; then
  stop_services
  ( cd "$MOCK" && docker compose down )
  ( cd "$UI_DIR" && docker compose -f docker-compose.hossted.yml down )
  docker compose -f "$INFRA" down
  echo "Torn down (services + infra + mock)."
  exit 0
fi

probe() { local code; code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$1" || echo 000)"; [[ "$code" -ge 200 && "$code" -lt 500 ]]; }

seed_env() {  # dst  template
  if [[ ! -f "$1" ]]; then
    cp "$2" "$1"
    echo "[env] $1 was missing — seeded from $(basename "$2"). Review it (placeholder secrets!)." >&2
  fi
}
seed_env "$GATEWAY/.env" "$GATEWAY/env.example"
seed_env "$HANDLER/.env" "$HANDLER/env.example"

echo "[deps] checking..."
for r in "$GATEWAY" "$HANDLER"; do
  ( cd "$r" && poetry env info -p >/dev/null 2>&1 ) || ( cd "$r" && poetry install )
done
[[ -d "$UI_DIR/node_modules" ]] || ( cd "$UI_DIR" && npm install )

echo "[infra] starting postgres + kafka + redis + pusher..."
docker compose -f "$INFRA" up -d
echo "[infra] waiting for postgres..."
pg_ready=0
for _ in $(seq 1 30); do
  if docker compose -f "$INFRA" exec -T postgres pg_isready -U keep >/dev/null 2>&1; then pg_ready=1; break; fi
  sleep 2
done
[[ "$pg_ready" == "1" ]] || { echo "Postgres did not become ready in time" >&2; exit 1; }

echo "[db] running migrations..."
( cd "$GATEWAY" && poetry run alembic upgrade head )

start_svc() {  # name  dir  cmd...
  local name="$1" dir="$2"; shift 2
  (
    cd "$dir"
    set -a; [[ -f .env ]] && . ./.env; set +a
    setsid nohup "$@" >"$LOGDIR/$name.out.log" 2>"$LOGDIR/$name.err.log" &
    echo $! >> "$PIDFILE"
  )
  echo "[$name] started -> $LOGDIR/$name.out.log"
}
start_svc api-gateway   "$GATEWAY" poetry run gunicorn src.main:get_app \
  --bind 0.0.0.0:8080 --workers 1 -k uvicorn.workers.UvicornWorker -c src/config/config.py
start_svc event-handler "$HANDLER" poetry run python -m src.consumer_main
start_svc ui            "$UI_DIR"  npm run dev

# Both compose files hardcode container_name, so a container from a
# DIFFERENT checkout (e.g. another clone of this same repo on this machine)
# collides on the name with "Conflict: ... already in use" — docker compose
# won't touch a container it doesn't consider part of its own project. This
# script assumes one dev stack per machine, so on that specific conflict,
# remove the stale container and retry once rather than failing outright.
up_with_retry() {  # name  container_name  cmd...
  local name="$1" cname="$2"; shift 2
  local out
  if out="$("$@" 2>&1)"; then echo "$out"; return 0; fi
  if echo "$out" | grep -q "Conflict.*container name .*$cname"; then
    echo "[$name] a container named $cname exists from a different project — removing it and retrying" >&2
    docker rm -f "$cname" >/dev/null 2>&1 || true
    "$@"
  else
    echo "$out" >&2
    return 1
  fi
}

echo "[mock] starting hossted-survey-api..."
up_with_retry mock hossted-survey-api bash -c "cd '$MOCK' && docker compose up -d --build"

echo "[hossted-cache] starting the widget proxy's redis..."
up_with_retry hossted-cache keep-hossted-cache bash -c "cd '$UI_DIR' && docker compose -f docker-compose.hossted.yml up -d"

wait_health() {  # name  url
  local name="$1" url="$2"
  echo "[$name] waiting on $url ..."
  for _ in $(seq 1 45); do
    probe "$url" && { echo "[$name] healthy"; return 0; }
    sleep 2
  done
  echo "[$name] never became healthy — check $LOGDIR/$name.err.log" >&2
  return 1
}

ok=0
wait_health api-gateway "http://localhost:8080/healthcheck" || ok=1
wait_health ui          "http://localhost:3000"             || ok=1
wait_health mock        "http://localhost:4400"             || ok=1

if [[ "$ok" == "0" ]]; then
  echo -e "\nAll services up.\n  UI:   http://localhost:3000/alerts/feed\n  Mock: http://localhost:4400"
  echo "Run ./scripts/verify-hossted-mock.sh to confirm the widget reaches the mock."
else
  echo -e "\nSome services failed — inspect $LOGDIR before continuing." >&2
  exit 1
fi
