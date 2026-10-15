#!/usr/bin/env bash
# Wait for service /health endpoints to return HTTP 200.
# Usage: wait-for-health.sh <base_url> [<base_url> ...]
# Appends /health to each base URL. Fails after $HEALTH_TIMEOUT seconds
# (default 300) printing the per-endpoint status codes.
set -u

BASES=("$@")
if [ "${#BASES[@]}" -eq 0 ]; then
  BASES=(http://localhost:8080 http://localhost:8010)
fi
TIMEOUT="${HEALTH_TIMEOUT:-300}"
INTERVAL=5

echo "Waiting for health endpoints (timeout ${TIMEOUT}s):"
for base in "${BASES[@]}"; do
  echo "  - $base/health"
done

start=$(date +%s)
while true; do
  all_ok=1
  for base in "${BASES[@]}"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$base/health" 2>/dev/null || echo "000")
    if [ "$code" != "200" ]; then
      all_ok=0
    fi
  done
  if [ "$all_ok" = "1" ]; then
    echo "All services healthy."
    exit 0
  fi
  now=$(date +%s)
  if [ $((now - start)) -ge "$TIMEOUT" ]; then
    echo "FAIL: timed out waiting for health endpoints:"
    for base in "${BASES[@]}"; do
      code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$base/health" 2>/dev/null || echo "000")
      echo "  $base/health -> $code"
    done
    exit 1
  fi
  sleep "$INTERVAL"
done
