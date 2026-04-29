# Credentials placement guide

Single source of truth: **`/home/nolank/project/cms-akamai-platform/.env`** (never committed; covered by `.gitignore`).
Everything else either reads from there, or is a generated artifact (JWT key files, certificates).

## File layout

| File                                        | Purpose                                            | Format          |
|---------------------------------------------|----------------------------------------------------|-----------------|
| `.env`                                      | All runtime secrets for `cms-api` + docker compose | KEY=VALUE       |
| `apps/cms-admin/.env.local`                 | Browser-public Next.js env for admin               | NEXT_PUBLIC_*   |
| `apps/web-frontend/.env.local`              | Server-side fetch URL for SSR                      | KEY=VALUE       |
| `apps/cms-api/keys/jwt-private.pem`         | JWT signing key (RS256). chmod 600.                | PEM             |
| `apps/cms-api/keys/jwt-public.pem`          | JWT verification key                               | PEM             |
| `/etc/letsencrypt/live/<domain>/*.pem`      | TLS cert + key (Let's Encrypt)                     | managed by certbot |

## What goes where

### 1. Database / cache / object store
Already filled in `.env` for local docker compose. Update only when pointing at a managed service.

```
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DBNAME
REDIS_URL=redis://:PASS@HOST:6379
S3_ENDPOINT=https://s3.amazonaws.com   # leave blank for AWS, set for MinIO/R2
S3_REGION=ap-northeast-2
S3_BUCKET_MEDIA=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

If you're using **MinIO** (default in dev): keep `S3_ENDPOINT=http://localhost:17900`, dev access keys are already filled.

### 2. JWT signing
`apps/cms-api/src/auth/auth.module.ts` reads RSA keys from `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH`. The repo bootstrapper generated `apps/cms-api/keys/jwt-{private,public}.pem` for you. To rotate:

```bash
cd apps/cms-api
openssl genpkey -algorithm RSA -out keys/jwt-private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in keys/jwt-private.pem -out keys/jwt-public.pem
chmod 600 keys/jwt-private.pem
pm2 restart cms-api
```

Falls back to HS256 with `SESSION_SECRET` if the files are missing.

### 3. Symmetric secrets in `.env`
These are random strings — already populated with `openssl rand -hex` values:

```
PREVIEW_JWT_SECRET=...      # signs short-lived preview links
SESSION_SECRET=...          # cookie/session signing + JWT fallback
ORIGIN_SHARED_SECRET=...    # required by Akamai EdgeWorker/property to call origin
```

Rotate by replacing the value and restarting the API. **All three should differ in production** even if values were the same in dev.

### 4. OIDC / SSO (optional)
If you wire SSO (Google / Okta / Azure AD), fill these in `.env`:

```
OIDC_ISSUER=https://accounts.google.com
OIDC_CLIENT_ID=...           # from your provider's console
OIDC_CLIENT_SECRET=...       # treat like a database password
OIDC_CALLBACK_URL=https://dimicms.duckdns.org/api/v1/auth/callback
```

The callback URL must match exactly what's registered with the provider. **Update the provider's allow-list to include the `https://dimicms.duckdns.org/...` URL** before flipping over.

### 5. Akamai (optional, for real CDN purges)
The `purge` module supports two modes:
- **Dry-run / mock** (default): logs to `purge_log` table, no upstream calls. Good for development.
- **Real Akamai EdgeGrid**: requires the four credentials below in `.env`. Get them from Akamai Control Center → Identity & Access → API users → Create credential. Pick API category "CCU" (Fast Purge).

```
AKAMAI_HOST=akab-xxxxxxxxxx.luna.akamaiapis.net
AKAMAI_CLIENT_TOKEN=akab-...
AKAMAI_CLIENT_SECRET=...
AKAMAI_ACCESS_TOKEN=akab-...
AKAMAI_NETWORK=staging          # or production
AKAMAI_CONTRACT_ID=...
AKAMAI_GROUP_ID=...
```

Save Akamai's `.edgerc` securely (chmod 600) on machines that already use Akamai CLI; this project reads only from `.env`.

### 6. Email (optional)
`SMTP_*` is wired to Mailhog locally. For real email use:

```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<provider api key>
EMAIL_FROM=noreply@dimicms.duckdns.org
```

### 7. DuckDNS token (recommended)
DuckDNS lets you script subdomain → IP updates. Store the token *outside the repo*:

```bash
# /etc/duckdns/dimicms.token  (chmod 600, owner root)
```

Add a cron entry (every 5 min) so the IP stays fresh after ISP changes:

```cron
*/5 * * * * curl -fsS "https://www.duckdns.org/update?domains=dimicms&token=$(cat /etc/duckdns/dimicms.token)&ip=" >/dev/null
```

This token is a long-lived bearer credential — it lets anyone repoint your subdomain. Treat it like an SSH key.

### 8. TLS certificate
Issued automatically by `scripts/setup-public-host.sh` via Let's Encrypt → certbot. Stored in `/etc/letsencrypt/live/dimicms.duckdns.org/`. Renewal is handled by the system `certbot.timer` unit (verify with `systemctl list-timers | grep certbot`).

### 9. CORS / public origin
For the browser to call the API from the public domain:

```
PUBLIC_BASE_URL=https://dimicms.duckdns.org
CORS_ORIGINS=https://dimicms.duckdns.org,http://localhost:17001,http://localhost:17002
```

`apps/cms-admin/.env.local` must have:

```
NEXT_PUBLIC_API_URL=https://dimicms.duckdns.org/api/v1
```

(`apps/web-frontend/.env.local` keeps `CMS_API_URL=http://127.0.0.1:17000/api/v1` because that's a server-side fetch.)

## Loading order at runtime
1. `pm2 start ecosystem.config.cjs` exports `ENV_FILE=<repo>/.env` to `cms-api`.
2. `cms-api`'s `data-source.ts` and `dotenv` (via NestJS ConfigModule) load `.env.local` first then `.env`.
3. Next.js (admin/web-frontend) loads `.env.local` automatically per app.
4. JWT keys are read from disk by `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` (defaults to `./keys/jwt-{private,public}.pem` resolved against the cms-api cwd).

## Hygiene
- `.env`, `.env.local`, `keys/` are all in `.gitignore`. Verify with `git status` before committing.
- For team sharing of secrets use a vault (1Password, Bitwarden, AWS Secrets Manager, sops + age, etc.) — never commit them.
- For prod, prefer environment-injected secrets from your orchestrator (Kubernetes secret, Docker swarm secret, systemd `EnvironmentFile=`).
