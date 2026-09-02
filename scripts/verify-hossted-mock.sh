#!/usr/bin/env bash
# Verifies that HOSSTED_UPSTREAM_URL/HOSSTED_UPSTREAM_TOKEN in .env actually
# reach the hossted-survey-api MOCK server's /api/integrations route and get
# back a usable response — the same request @hossted/keep-integration's
# HosstedButton sends through app/api/hossted/route.ts.
#
# Usage: ./scripts/verify-hossted-mock.sh [.env path]
set -euo pipefail

ENV_FILE="${1:-.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL: $ENV_FILE not found" >&2
  exit 1
fi

UPSTREAM_URL=$(grep -E '^HOSSTED_UPSTREAM_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2-)
UPSTREAM_TOKEN=$(grep -E '^HOSSTED_UPSTREAM_TOKEN=' "$ENV_FILE" | tail -1 | cut -d= -f2-)

if [ -z "$UPSTREAM_URL" ] || [ -z "$UPSTREAM_TOKEN" ]; then
  echo "FAIL: HOSSTED_UPSTREAM_URL or HOSSTED_UPSTREAM_TOKEN missing from $ENV_FILE" >&2
  exit 1
fi

case "$UPSTREAM_URL" in
  *:7007*)
    echo "FAIL: HOSSTED_UPSTREAM_URL ($UPSTREAM_URL) points at the real local Hossted" >&2
    echo "      platform (hkb_rag, port 7007), not the mock server. Point it at" >&2
    echo "      hossted-survey-api instead (default: http://localhost:4400/api/integrations)." >&2
    exit 1
    ;;
esac

echo "Testing $UPSTREAM_URL ..."
BODY='{"integrationName":"keep","type":"alert","messageId":"verify-hossted-mock","stream":false,"payload":{"fingerprint":"verify-hossted-mock"},"response_type":"html"}'
RESPONSE=$(curl -s -w '\n%{http_code}' -X POST "$UPSTREAM_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $UPSTREAM_TOKEN" \
  -d "$BODY")
STATUS=$(echo "$RESPONSE" | tail -1)
JSON=$(echo "$RESPONSE" | sed '$d')

if [ "$STATUS" != "200" ]; then
  echo "FAIL: got HTTP $STATUS from the mock server:" >&2
  echo "$JSON" >&2
  echo "" >&2
  echo "If this is 401/403: the mock's \"keep\" integration mapping's tokenValue" >&2
  echo "doesn't match HOSSTED_UPSTREAM_TOKEN. Sync it with:" >&2
  echo "  curl -X POST http://localhost:4400/api/v1/integration-mappings \\" >&2
  echo "    -H 'Content-Type: application/json' \\" >&2
  echo "    -d '{\"integration\":\"keep\",\"tokenValue\":\"'\"\$UPSTREAM_TOKEN\"'\",\"payloadIdField\":\"fingerprint\"}'" >&2
  exit 1
fi

if ! echo "$JSON" | jq -e '.summary and .response' >/dev/null 2>&1; then
  echo "FAIL: 200 response but missing summary/response fields (this is what" >&2
  echo "      the widget itself checks before treating the call as ok):" >&2
  echo "$JSON" >&2
  exit 1
fi

echo "OK: mock server responded with a usable summary/response."
echo "$JSON" | jq .
