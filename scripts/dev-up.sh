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
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) IS_WINDOWS=1 ;; *) IS_WINDOWS=0 ;; esac

stop_services() {  # kill the whole process GROUP each service was started in
  # (start_svc launches under `setsid`, so $pid is also its process group id) —
  # a plain `kill $pid` only hits e.g. `npm`, not the `next dev`/`next-server`
  # children it forked, which npm doesn't forward signals to.
  if [[ -f "$PIDFILE" ]]; then
    while IFS=: read -r kind pid; do
      [[ -n "${pid:-}" ]] || { pid="$kind"; kind="legacy"; }
      case "$kind" in
        windows) taskkill.exe //PID "$pid" //T //F >/dev/null 2>&1 || true ;;
        unix)    kill -- "-$pid" 2>/dev/null || true ;;
        legacy) kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true ;;
      esac
    done < "$PIDFILE"
    if [[ "$IS_WINDOWS" == "1" ]]; then
      # npm.cmd exits after spawning Next.js, so its recorded parent may already
      # be gone. Clean up listeners owned by this stack's fixed host ports too.
      for port in 3000 8080; do
        while read -r pid; do
          [[ -n "$pid" ]] && taskkill.exe //PID "$pid" //T //F >/dev/null 2>&1 || true
        done < <(netstat -ano | awk -v suffix=":$port" \
          '$1 == "TCP" && $2 ~ suffix "$" && $4 == "LISTENING" { print $5 }' | sort -u)
      done
    fi
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
[[ -d "$UI_DIR/node_modules/@hossted/keep-integration" ]] || ( cd "$UI_DIR" && npm install )

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
migrate() { ( cd "$GATEWAY" && poetry run alembic upgrade head ) 2>&1; }
if out="$(migrate)"; then
  echo "$out"
elif echo "$out" | grep -q "Can't locate revision identified by"; then
  echo "[db] alembic_version in the Postgres volume doesn't match this checkout — wiping the volume and retrying" >&2
  docker compose -f "$INFRA" down -v
  docker compose -f "$INFRA" up -d
  pg_ready=0
  for _ in $(seq 1 30); do
    if docker compose -f "$INFRA" exec -T postgres pg_isready -U keep >/dev/null 2>&1; then pg_ready=1; break; fi
    sleep 2
  done
  [[ "$pg_ready" == "1" ]] || { echo "Postgres did not become ready in time" >&2; exit 1; }
  migrate
else
  echo "$out" >&2
  exit 1
fi

start_svc() {  # name  dir  cmd...
  local name="$1" dir="$2" bgpid native_pid; shift 2
  (
    cd "$dir"
    set -a; [[ -f .env ]] && . ./.env; set +a
    # setsid (util-linux) isn't available on Git Bash/MSYS2 on Windows —
    # fall back to plain nohup there; --down's process-group kill then only
    # gets the immediate pid, same as before setsid was added.
    if command -v setsid >/dev/null 2>&1; then
      setsid nohup "$@" >"$LOGDIR/$name.out.log" 2>"$LOGDIR/$name.err.log" &
    else
      nohup "$@" >"$LOGDIR/$name.out.log" 2>"$LOGDIR/$name.err.log" &
    fi
    bgpid=$!
    if [[ "$IS_WINDOWS" == "1" ]]; then
      # MSYS uses its own pid namespace; taskkill needs the native Windows pid.
      native_pid="$(ps | awk -v pid="$bgpid" 'NR > 1 && $1 == pid { print $4 }')"
      echo "windows:${native_pid:-$bgpid}" >> "$PIDFILE"
    else
      echo "unix:$bgpid" >> "$PIDFILE"
    fi
  )
  echo "[$name] started -> $LOGDIR/$name.out.log"
}

# Remove processes recorded by an earlier run before replacing the pid file.
stop_services
: > "$PIDFILE"

if [[ "$IS_WINDOWS" == "1" ]]; then
  # Gunicorn imports the Unix-only fcntl module. The gateway's native entrypoint
  # runs Uvicorn directly and works on Windows.
  start_svc api-gateway "$GATEWAY" poetry run python -m src.main
else
  start_svc api-gateway "$GATEWAY" poetry run gunicorn src.main:get_app \
    --bind 0.0.0.0:8080 --workers 1 -k uvicorn.workers.UvicornWorker -c src/config/config.py
fi
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
  # The mock runs in Docker, where localhost is the mock container itself.
  # Seed its callback settings after every container recreation.
  curl -fsS -X POST "http://localhost:4400/admin/api/settings" \
    -H "Content-Type: application/json" \
    --data '{"keepApiUrl":"http://keep-backend-dev:8080","keepApiKey":"dev-noauth"}' \
    >/dev/null
  curl -fsS -X POST "http://localhost:4400/api/v1/integration-mappings" \
    -H "Content-Type: application/json" \
    --data '{"integration":"keep","tokenValue":"mock-keep-token","payloadIdField":"fingerprint"}' \
    >/dev/null
  echo "[mock] Keep callback configured -> http://keep-backend-dev:8080"
fi

if [[ "$ok" == "0" ]]; then
  echo -e "\nAll services up.\n  UI:   http://localhost:3000/alerts/feed\n  Mock: http://localhost:4400"
  echo "Run ./scripts/verify-hossted-mock.sh to confirm the widget reaches the mock."
else
  echo -e "\nSome services failed — inspect $LOGDIR before continuing." >&2
  exit 1
fi
