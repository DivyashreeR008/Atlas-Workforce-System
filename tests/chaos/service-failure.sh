#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
SERVICE_NAME="${1:-attendance-service}"
SERVICE_PORT="${2:-8005}"
API_GATEWAY="${API_GATEWAY:-http://localhost:8080}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-atlas-workforce-system}"
AUTH_EMAIL="${AUTH_EMAIL:-admin@atlas.io}"
AUTH_PASS="${AUTH_PASS:-ChangeMe123!}"
AUTH_URL="${AUTH_URL:-http://localhost:8010}"
SLEEP_BETWEEN="${SLEEP_BETWEEN:-3}"
MAX_RETRIES=12

# ── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[PASS]${NC}  $*"; }
log_fail()  { echo -e "${RED}[FAIL]${NC}  $*"; FAILED=1; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }

FAILED=0

# ── Helpers ────────────────────────────────────────────────────────────────

get_token() {
  local res
  res=$(curl -sf -X POST "$AUTH_URL/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$AUTH_EMAIL\",\"password\":\"$AUTH_PASS\"}") || return 1
  echo "$res" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || return 1
}

health_check() {
  local service="${1:-$API_GATEWAY/health}"
  local retries=0
  while [ $retries -lt $MAX_RETRIES ]; do
    if curl -sf "$service" > /dev/null 2>&1; then
      return 0
    fi
    retries=$((retries + 1))
    sleep 2
  done
  return 1
}

check_gateway_up() {
  if health_check "$API_GATEWAY/health"; then
    log_ok "API Gateway is reachable"
    return 0
  fi
  log_fail "API Gateway is not reachable"
  return 1
}

check_http_code() {
  local url="$1" expected="$2" desc="$3" token="$4"
  local code
  code=$(curl -so /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" "$url" || echo "000")
  local matched=false
  for e in $expected; do
    [ "$code" = "$e" ] && matched=true
  done
  if $matched; then
    log_ok "$desc — returned $code (expected)"
  else
    log_fail "$desc — returned $code (expected one of: $expected)"
  fi
}

check_other_services() {
  local token="$1"
  local endpoints=(
    "$API_GATEWAY/api/employee/employees?page=1&page_size=1"
    "$API_GATEWAY/api/leave"
  )
  for ep in "${endpoints[@]}"; do
    check_http_code "$ep" "200 401 403" "Other service $ep" "$token"
  done
}

# ── Main ───────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "   Chaos Test: Service Failure — $SERVICE_NAME"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. Verify API Gateway is healthy
log_info "Step 1: Verifying API Gateway is healthy..."
check_gateway_up

# 2. Obtain auth token
log_info "Obtaining auth token..."
TOKEN=$(get_token) || { log_fail "Failed to obtain auth token"; exit 1; }
log_ok "Auth token obtained"

# 3. Stop the target service
echo ""
log_info "Step 2: Stopping $SERVICE_NAME..."
if docker ps --format '{{.Names}}' | grep -q "$SERVICE_NAME"; then
  docker stop "$SERVICE_NAME" 2>/dev/null || true
  log_warn "Stopped container: $SERVICE_NAME"
else
  log_warn "Container $SERVICE_NAME not running (may use compose name)"
  docker compose -p "$COMPOSE_PROJECT" stop "$SERVICE_NAME" 2>/dev/null || true
  log_warn "Stopped compose service: $SERVICE_NAME"
fi

sleep "$SLEEP_BETWEEN"

# 4. Verify the API gateway returns 503 for the failed service
echo ""
log_info "Step 3: Verifying gateway returns 503 for $SERVICE_NAME..."
FAILED_ENDPOINT="$API_GATEWAY/api/attendance"
check_http_code "$FAILED_ENDPOINT" "503 502 000" "Gateway for failed service" "$TOKEN"

# 5. Verify other services remain available
echo ""
log_info "Step 4: Verifying other services remain available..."
check_other_services "$TOKEN"

# 6. Restart the service
echo ""
log_info "Step 5: Restarting $SERVICE_NAME..."
docker start "$SERVICE_NAME" 2>/dev/null || \
  docker compose -p "$COMPOSE_PROJECT" start "$SERVICE_NAME" 2>/dev/null || \
  docker compose -p "$COMPOSE_PROJECT" up -d "$SERVICE_NAME" 2>/dev/null || true

log_info "Waiting for $SERVICE_NAME to become healthy..."
if health_check "http://localhost:$SERVICE_PORT/health"; then
  log_ok "$SERVICE_NAME is healthy again"
else
  log_warn "Could not verify $SERVICE_NAME health at port $SERVICE_PORT (may use different health path)"
fi

sleep "$SLEEP_BETWEEN"

# 7. Verify recovery
echo ""
log_info "Step 6: Verifying automatic recovery..."
check_http_code "$FAILED_ENDPOINT" "200 401 403" "Service recovery" "$TOKEN"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "   Chaos Test Complete"
echo "═══════════════════════════════════════════════════════════════"
exit $FAILED
