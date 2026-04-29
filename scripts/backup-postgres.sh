#!/usr/bin/env bash
#
# dimi-cms — Postgres dump.
#
# By default writes to ./backups/<timestamp>.sql.gz.
# Designed to run from cron / systemd timer:
#
#   30 3 * * *  /home/nolank/project/cms-akamai-platform/scripts/backup-postgres.sh
#
# Optional env knobs:
#   BACKUP_DIR     where to write (default: <repo>/backups)
#   RETAIN_DAYS    delete dumps older than N days (default: 14, 0 to disable)
#   PG_CONTAINER   docker container name (default: cms-postgres)
#   S3_TARGET      if set, also `aws s3 cp` the dump to this URI
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
PG_CONTAINER="${PG_CONTAINER:-cms-postgres}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/cms_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

if ! docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER}\$"; then
  echo "Postgres container ${PG_CONTAINER} is not running." >&2
  exit 1
fi

echo "→ Dumping cms database from container ${PG_CONTAINER}"
docker exec -i "${PG_CONTAINER}" pg_dump \
  -U cms_admin -d cms --no-owner --no-privileges --clean --if-exists \
  | gzip -9 > "${OUT}"

SIZE=$(du -h "${OUT}" | awk '{print $1}')
echo "→ Wrote ${OUT} (${SIZE})"

if [ -n "${S3_TARGET:-}" ]; then
  echo "→ Uploading to ${S3_TARGET}"
  aws s3 cp "${OUT}" "${S3_TARGET}/"
fi

if [ "${RETAIN_DAYS}" -gt 0 ]; then
  echo "→ Pruning dumps older than ${RETAIN_DAYS} day(s)"
  find "${BACKUP_DIR}" -type f -name 'cms_*.sql.gz' -mtime +"${RETAIN_DAYS}" -print -delete
fi

echo "✓ Backup complete"
