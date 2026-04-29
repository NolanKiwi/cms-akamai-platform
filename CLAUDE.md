# CLAUDE.md

Briefing for any future Claude (or human) session opening this repo. Skim
the whole file before changing things — it captures decisions and runtime
state that aren't obvious from the source.

## What this is

`dimi-cms` — a content delivery & cache control platform built around
Akamai. It's a Turborepo monorepo with three Next.js / NestJS apps and
shared infra config. Currently running as a small staging deployment on
a single host behind Nginx + duckdns; long-term target is EKS + Akamai
edge per the docs.

Project docs live in `docs/01-*.md` … `docs/16-*.md` (high-level design,
DB schema, Akamai rules, security, observability, etc.). Use those as
the source of truth for design decisions; this file describes what is
actually built and running.

## Apps

| App | Path | Port (dev) | Notes |
|---|---|---|---|
| `cms-admin` | `apps/cms-admin` | 17001 (Next start) | Editorial console (Next.js 14, App Router, Tailwind, Tremor, react-query, axios) |
| `cms-api` | `apps/cms-api` | 17000 | NestJS API + BullMQ workers + TypeORM (Postgres) + Redis + S3-compatible storage adapter |
| `web-frontend` | `apps/web-frontend` | 17002 | Public-facing Next.js renderer for content sites |

Base URL the admin uses: `NEXT_PUBLIC_API_URL` (default
`http://localhost:17000/api/v1`). On the deployed host it points at the
local cms-api; Nginx terminates TLS for `dimicms.duckdns.org`.

## Runtime / deployment

- Production-ish staging is `https://dimicms.duckdns.org` (admin console
  served at root, web-frontend on a separate vhost). All three apps run
  under **PM2** on the host — see `ecosystem.config.cjs`.
- `pm2 list` should show `cms-api`, `cms-admin`, `web-frontend` online.
  Restart with `pm2 restart cms-admin` (or the matching name) after
  rebuilding.
- `cms-admin` runs `npm run start` (production build). After editing
  pages, you must `cd apps/cms-admin && npm run build` then
  `pm2 restart cms-admin`. Do NOT skip the build — pm2 would otherwise
  serve stale code.
- `cms-api` runs `npm run dev` under pm2 (ts-node-dev), so changes there
  take effect on `pm2 restart cms-api` without an explicit build.
- Logs land in `logs/<app>.{out,err}.log`.
- Nginx config under `infra/nginx/`. TLS via certbot/duckdns.

## Local stack vs cloud

For local development the Docker Compose file (`docker-compose.yml`) brings
up Postgres / Redis / MinIO / OpenSearch / mailhog. Production targets
are AWS-managed equivalents (RDS / ElastiCache / S3 / OpenSearch) per
docs/11. Akamai pieces (PAPI, CCU, EdgeWorkers, EdgeKV, IVM, AMD, etc.)
are reached through `apps/cms-api/src/akamai/` which signs with EdgeGrid.

## Auth

Local JWT only (no OIDC yet — Phase 1 backlog item). Token stored in
cookie `cms_token` by `apps/cms-admin/lib/api.ts`. RBAC roles: `VIEWER`,
`DEVELOPER`, `ADMIN`. Most admin endpoints require DEVELOPER+.

## API Tester (admin → System → API Tester)

`apps/cms-admin/app/api-tester/` is a self-service tester that supports
two targets:

- **CMS** — hits `cms-api` directly with the user's bearer token.
  Presets in `cms-catalog.ts`.
- **Akamai** — sends `{method, path, body}` to
  `POST /admin/akamai/proxy`, which forwards via EdgeGrid v1 (signed by
  the server). Presets in `akamai-catalog.ts` cover ~60 endpoints from
  `akamai/akamai-apis` (PAPI, CCU/Fast Purge, Reporting v1/v2,
  EdgeWorkers, EdgeKV, Edge DNS, GTM, CPS, CPRG, IAM, Network Lists,
  Site Shield, App & API Protector, DataStream 2, IVM, AMD, Cloudlets,
  Test Center, Diagnostic Tools, Account Switching).

Important behaviors to preserve:

- Sidebar is **fixed at 22rem** (`lg:grid-cols-[minmax(0,1fr)_22rem]`)
  so the request pane keeps the same width when toggling CMS↔Akamai.
- Catalog uses a Select dropdown for groups (NOT chips) and the list
  scrolls inside a capped Card. Don't reintroduce chip-grid layouts —
  they re-grow vertically when the catalog gets bigger.
- Response renderer (`ResponseBody`) measures payload size once and
  truncates anything over 200 KB to a 50 KB preview. Always offer Copy
  / Download .json / Render-full toggle. Do not pretty-print huge
  payloads — that's what froze the browser before. Keep this guarded.

## Akamai integration

- Generic signing client: `apps/cms-api/src/akamai/akamai-client.service.ts`.
  Two methods: `request<T>()` returns body only; `requestRaw()` returns
  `{ status, headers, data, dryRun }` and powers the proxy.
- "Dry-run mode" kicks in automatically when `AKAMAI_HOST` is unset —
  no real calls are made; calls return `{ dryRun: true, ... }`. The
  admin tester surfaces this with a badge.
- Required env vars in `.env`:
  `AKAMAI_HOST`, `AKAMAI_CLIENT_TOKEN`, `AKAMAI_CLIENT_SECRET`,
  `AKAMAI_ACCESS_TOKEN`. See `docs/CREDENTIALS.md`.
- Domain-specific services already wired: `papi.service.ts`,
  `reporting.service.ts`, `edgeworkers.service.ts`, `edge-dns.service.ts`,
  `cpcode.service.ts`. Prefer extending these (or adding new domain
  services) over adding more raw routes — the proxy is for ad-hoc
  tester use, not application code paths.

## Phase status (snapshot as of 2026-04-29)

Source of truth is `TODO.md`; current high-level state:

- **Phase 0** — Domain (duckdns staging) and monorepo bootstrap done.
  Stakeholder workshops, Akamai contract entitlement, OIDC choice,
  cloud-region/IAM, video transcoding decision **still open**.
- **Phase 1** — API/admin/CRUD/workflow/audit/Redis/throttler/Docker
  Compose all working. Open: OIDC SSO, ≥80% unit-test coverage,
  GitHub Actions CI.
- **Phase 2** — Cache headers (`Surrogate-Control` / `Surrogate-Key`)
  emitted; Akamai property/Terraform/TLS/Site Shield not yet wired.
- **Phase 3 (Publishing & Purge)** — BullMQ queues, publisher worker,
  purge worker, Fast Purge client, cache-tag generation, purge log,
  webhook delivery, emergency purge UI all in. Open: OpenSearch
  indexer, Grafana dashboards.
- **Phase 4 (Media)** — S3-style storage adapter, presigned upload, DAM
  browser, image picker, asset cache-tag linking in. Open: sharp
  pipeline, focal point, IVM property, malware scan, WebP/AVIF tests.
- **Phases 5–9** — not started.

## Conventions for changes

- TypeScript strict everywhere; `npx tsc --noEmit` from each app must
  pass. Run that before committing UI/backend changes.
- Don't add comments that just describe what code does; only WHY-style
  comments where a constraint isn't obvious.
- When adding a new admin page, also wire the nav item in
  `apps/cms-admin/components/layout/nav-config.ts`.
- Korean is fine in copy and CLI replies; the codebase mixes EN/KO.
- Don't run destructive `git` actions, force-push, or hook-skipping
  commits without an explicit ask.

## Useful commands

```bash
# Build + restart admin after a UI change
( cd apps/cms-admin && npm run build ) && pm2 restart cms-admin

# Restart API (no build needed, ts-node-dev)
pm2 restart cms-api

# Tail logs
pm2 logs cms-api --lines 100

# Health probes
curl https://dimicms.duckdns.org/api/v1/health
curl https://dimicms.duckdns.org/api-tester  # admin page
```

## Where to look first when something breaks

- 502 / blank page on duckdns → `pm2 list`, then `pm2 logs <name>`.
- Auth loop → check `cms_token` cookie; the axios interceptor in
  `apps/cms-admin/lib/api.ts` clears it on 401 and routes to
  `/auth/login`.
- Akamai call returning `{ dryRun: true, ... }` → `.env` is missing
  EdgeGrid creds. Set them and `pm2 restart cms-api`.
- "Path contains placeholders" error in API tester → user left `{x}`
  segments in the URL; not a bug.
