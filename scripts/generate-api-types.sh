#!/usr/bin/env bash
#
# Generate TypeScript types for the cms-api OpenAPI spec.
# Requires the API to be running at $API_URL (default: http://localhost:17000).
#
# Outputs:
#   apps/cms-admin/lib/api-types.ts
#   apps/web-frontend/lib/api-types.ts (also)
#
set -euo pipefail

API_URL="${API_URL:-http://localhost:17000}"
SPEC_PATH="${SPEC_PATH:-/api/docs-json}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

OUT_ADMIN="$ROOT_DIR/apps/cms-admin/lib/api-types.ts"
OUT_WEB="$ROOT_DIR/apps/web-frontend/lib/api-types.ts"

echo "→ Fetching OpenAPI from $API_URL$SPEC_PATH"
if ! curl -sf "$API_URL$SPEC_PATH" -o /tmp/cms-openapi.json; then
  echo "✖ Failed to fetch OpenAPI spec. Is the API running?" >&2
  exit 1
fi

echo "→ Generating $OUT_ADMIN"
npx openapi-typescript /tmp/cms-openapi.json -o "$OUT_ADMIN" --immutable

echo "→ Generating $OUT_WEB"
npx openapi-typescript /tmp/cms-openapi.json -o "$OUT_WEB" --immutable

echo "✓ Done. Import like:"
echo "    import type { paths, components } from '@/lib/api-types';"
