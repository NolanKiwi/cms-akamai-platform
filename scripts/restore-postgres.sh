#!/usr/bin/env bash
#
# dimi-cms — restore Postgres from a dump produced by backup-postgres.sh.
# Usage:
#   scripts/restore-postgres.sh ./backups/cms_20260427T030000Z.sql.gz
#
set -euo pipefail

DUMP="${1:-}"
PG_CONTAINER="${PG_CONTAINER:-cms-postgres}"

if [ -z "${DUMP}" ] || [ ! -f "${DUMP}" ]; then
  echo "Usage: $0 <path-to-dump.sql.gz>" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER}\$"; then
  echo "Postgres container ${PG_CONTAINER} is not running." >&2
  exit 1
fi

read -r -p "About to RESTORE ${DUMP} into ${PG_CONTAINER}/cms. This will overwrite. Continue? [y/N] " ans
case "${ans}" in [yY]*) ;; *) echo "aborted"; exit 1 ;; esac

echo "→ Restoring"
gunzip -c "${DUMP}" | docker exec -i "${PG_CONTAINER}" psql -U cms_admin -d cms

echo "✓ Restore complete"
