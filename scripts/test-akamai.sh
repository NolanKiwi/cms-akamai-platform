#!/usr/bin/env bash
#
# dimi-cms — Akamai read-only smoke test.
#
# Drives the four lowest-risk endpoints to confirm a credential set works:
#   1. /admin/akamai/status            → dryRun true/false
#   2. /admin/akamai/cpcodes           → CP Codes & Reporting Groups list
#   3. /admin/akamai/papi/groups       → PAPI groups
#   4. /admin/akamai/cpcodes/<id>/traffic?hours=24
#        when at least one CP code is found
#
# Usage:
#   BASE=https://dimicms.duckdns.org \
#   ADMIN_EMAIL=admin@dimicms.local \
#   ADMIN_PASSWORD='Dimicms123!@#' \
#   bash scripts/test-akamai.sh
#
set -euo pipefail

BASE="${BASE:-https://dimicms.duckdns.org}"
EMAIL="${ADMIN_EMAIL:-admin@dimicms.local}"
PASSWORD="${ADMIN_PASSWORD:-Dimicms123!@#}"

cyan() { printf "\033[36m%s\033[0m\n" "$*"; }
red()  { printf "\033[31m%s\033[0m\n" "$*"; }
green(){ printf "\033[32m%s\033[0m\n" "$*"; }
gray() { printf "\033[90m%s\033[0m\n" "$*"; }

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    red "jq is required (sudo apt-get install jq)" >&2
    exit 1
  fi
}
require_jq

cyan "→ 1/4  Login as ${EMAIL}"
TOKEN=$(curl -sf -X POST "${BASE}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg e "${EMAIL}" --arg p "${PASSWORD}" '{email:$e,password:$p}')" \
  | jq -r '.accessToken // empty')
if [ -z "${TOKEN}" ]; then
  red "Login failed. Check ADMIN_EMAIL/ADMIN_PASSWORD."
  exit 1
fi
gray "  token: ${TOKEN:0:24}…"

auth_curl() { curl -sf -H "Authorization: Bearer ${TOKEN}" "$@"; }

cyan "→ 2/4  Akamai client status"
STATUS=$(auth_curl "${BASE}/api/v1/admin/akamai/status")
echo "${STATUS}" | jq .
DRY=$(echo "${STATUS}" | jq -r '.dryRun')
if [ "${DRY}" = "true" ]; then
  red  "  dryRun=true — Akamai credentials are not loaded."
  red  "  Fill .env (AKAMAI_HOST/CLIENT_TOKEN/CLIENT_SECRET/ACCESS_TOKEN) and 'pm2 restart cms-api'."
  exit 1
fi
green "  dryRun=false — credentials loaded."

cyan "→ 3/4  CP Codes (CPRG API: GET /cprg/v1/cpcodes)"
CPC=$(auth_curl "${BASE}/api/v1/admin/akamai/cpcodes")
COUNT=$(echo "${CPC}" | jq '(.cpcodes // .items // []) | length')
echo "${CPC}" | jq '(.cpcodes // .items // .) | (if type=="array" then .[0:3] else . end)'
green "  Found ${COUNT} CP code(s) (showing up to 3 above)"

cyan "→ 4/4  PAPI Groups (sanity check on the same credential)"
auth_curl "${BASE}/api/v1/admin/akamai/papi/groups" \
  | jq '{groups: (.groups.items // .items // .)[0:3]}' || true

if [ "${COUNT}" -gt 0 ]; then
  CPID=$(echo "${CPC}" | jq -r '(.cpcodes // .items // [])[0] | (.cpcodeId // .id // .name)')
  cyan "→ Bonus  Reporting v1 traffic-by-time for CP code ${CPID} (last 24h, hourly)"
  auth_curl "${BASE}/api/v1/admin/akamai/cpcodes/${CPID}/traffic?hours=24&interval=HOUR" \
    | jq '{metadata: .metadata, summary: .summaryStatistics, dataHead: (.data // [])[0:3]}' \
    || red "  Reporting call failed — your credential may not have Reporting v1 read or the report 'traffic-by-time' is not visible to your account."
fi

green "✓ Akamai smoke test complete"
