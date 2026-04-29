#!/usr/bin/env bash
#
# One-shot setup for serving dimi-cms at dimicms.duckdns.org.
# Run as root (sudo). Idempotent: safe to re-run.
#
# Pre-conditions you must do FIRST (outside this script):
#   1. DuckDNS: log in, ensure subdomain `dimicms` points to this host's
#      public IP. Optionally automate with a DUCKDNS_TOKEN updater cron.
#   2. Open ports 80 and 443 inbound on your router/firewall.
#
# What this script does:
#   1. Installs a HTTP-only "bootstrap" nginx site for ACME challenges
#   2. Reloads nginx (this passes even without certs)
#   3. Issues a Let's Encrypt cert via certbot --webroot
#   4. Swaps in the full HTTPS site config
#   5. Reloads nginx again
#
set -euo pipefail

DOMAIN="${DOMAIN:-dimicms.duckdns.org}"
EMAIL="${LETSENCRYPT_EMAIL:-}"
SITE_CONF="/etc/nginx/sites-available/${DOMAIN}"
SITE_LINK="/etc/nginx/sites-enabled/${DOMAIN}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BOOTSTRAP_CONF="${REPO_ROOT}/infra/nginx/${DOMAIN}.bootstrap.conf"
FULL_CONF="${REPO_ROOT}/infra/nginx/${DOMAIN}.conf"

if [ "${EUID}" -ne 0 ]; then
  echo "Run with sudo." >&2
  exit 1
fi

if [ -z "${EMAIL}" ]; then
  echo "Set LETSENCRYPT_EMAIL=you@example.com (used for cert renewal notifications)." >&2
  exit 1
fi

for f in "${BOOTSTRAP_CONF}" "${FULL_CONF}"; do
  if [ ! -f "${f}" ]; then
    echo "Source nginx config not found: ${f}" >&2
    exit 1
  fi
done

mkdir -p /var/www/certbot

if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  echo "→ [1/4] Installing bootstrap (HTTP-only) nginx site"
  cp "${BOOTSTRAP_CONF}" "${SITE_CONF}"
  if [ ! -L "${SITE_LINK}" ]; then
    ln -s "${SITE_CONF}" "${SITE_LINK}"
  fi

  echo "→ [2/4] Reloading nginx for ACME challenge"
  nginx -t
  systemctl reload nginx

  echo "→ [3/4] Issuing certificate for ${DOMAIN}"
  certbot certonly --webroot -w /var/www/certbot \
    -d "${DOMAIN}" \
    --email "${EMAIL}" \
    --agree-tos --non-interactive \
    --no-eff-email
else
  echo "→ Certificate already present at /etc/letsencrypt/live/${DOMAIN}, skipping issue"
fi

echo "→ [4/4] Installing full HTTPS site config"
cp "${FULL_CONF}" "${SITE_CONF}"
if [ ! -L "${SITE_LINK}" ]; then
  ln -s "${SITE_CONF}" "${SITE_LINK}"
fi

nginx -t
systemctl reload nginx

echo
echo "✓ Done. Visit https://${DOMAIN}/"
echo "  API:     https://${DOMAIN}/api/v1/health"
echo "  Swagger: https://${DOMAIN}/api/docs"
echo
echo "Renewal: certbot installs a systemd timer automatically. Check with:"
echo "  systemctl list-timers | grep certbot"
