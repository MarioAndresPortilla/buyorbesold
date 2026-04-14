#!/usr/bin/env bash
# ============================================================
# Social Trading — End-to-end smoke test
# ============================================================
# Runs the exact sequence from Steps 8-11 of the deployment plan.
# Requires:
#   BASE_URL       — e.g. https://buyorbesold.com or http://localhost:3000
#   SESSION_COOKIE — value of the bobs-session cookie (from browser after login)
#   CRON_SECRET    — from Vercel env vars
#
# Usage:
#   BASE_URL=https://buyorbesold.com \
#   SESSION_COOKIE=eyJhbG... \
#   CRON_SECRET=xyz \
#   ./scripts/smoke-test-social.sh
# ============================================================

set -euo pipefail

: "${BASE_URL:?BASE_URL required}"
: "${SESSION_COOKIE:?SESSION_COOKIE required (value of bobs-session cookie)}"
: "${CRON_SECRET:?CRON_SECRET required}"

echo
echo "=== Step 8: Fetch empty feed + rankings ==="
echo
echo "> GET $BASE_URL/api/social/feed?limit=5"
curl -s "$BASE_URL/api/social/feed?limit=5" | head -c 500
echo
echo
echo "> GET $BASE_URL/api/social/rankings?period=1m"
curl -s "$BASE_URL/api/social/rankings?period=1m" | head -c 500
echo

echo
echo "=== Step 9: Create a test trade ==="
echo
TRADE_RESPONSE=$(curl -sS -X POST "$BASE_URL/api/social/trades" \
  -H "Cookie: bobs-session=$SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "asset_class": "stocks",
    "side": "long",
    "strategy": "swing",
    "size": 100,
    "entry_price": 195.50,
    "entry_date": "2026-04-10T14:30:00Z",
    "stop_price": 190.00,
    "target_price": 210.00,
    "thesis": "Smoke test — AAPL earnings setup"
  }')
echo "$TRADE_RESPONSE"

TRADE_ID=$(echo "$TRADE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$TRADE_ID" ]; then
  echo
  echo "ERROR: could not extract trade id. Check auth + DB." >&2
  exit 1
fi
echo
echo "Created trade id: $TRADE_ID"

echo
echo "=== Step 10: Close the trade (exit at +4.86%) ==="
echo
curl -sS -X PATCH "$BASE_URL/api/social/trades" \
  -H "Cookie: bobs-session=$SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$TRADE_ID\",
    \"exit_price\": 205.00,
    \"exit_date\": \"2026-04-13T19:30:00Z\"
  }" | head -c 500
echo

echo
echo "=== Step 11: Trigger stats recomputation ==="
echo
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "$BASE_URL/api/cron/recompute-stats" | head -c 1000
echo

echo
echo "=== Step 11b: Verify rankings now show the trader ==="
echo
echo "> GET $BASE_URL/api/social/rankings?period=all"
curl -sS "$BASE_URL/api/social/rankings?period=all" | head -c 1000
echo

echo
echo "=== Step 11c: Verify feed shows the trade ==="
echo
echo "> GET $BASE_URL/api/social/feed?limit=5"
curl -sS "$BASE_URL/api/social/feed?limit=5" | head -c 1000
echo

echo
echo "=== Done. ==="
echo
echo "Expected results:"
echo "  - Step 8:  empty 'trades' + 'rankings' arrays"
echo "  - Step 9:  new trade object with an 'id' field"
echo "  - Step 10: updated trade with exit_price + pnl_pct ~4.86"
echo "  - Step 11: {\"tradersProcessed\": N, \"statsUpserted\": M} with M > 0"
echo "  - Step 11b: rankings array contains your trader"
echo "  - Step 11c: feed array contains the AAPL trade"
