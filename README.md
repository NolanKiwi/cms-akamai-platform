# CMS Akamai Platform

Production-grade headless CMS with deep Akamai CDN integration.

## Quick Start (Local Development)

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| Docker + Compose | ≥ 24 | [docker.com](https://docker.com) |
| make | any | `brew install make` / `apt install make` |
| Terraform | ≥ 1.7 | [terraform.io](https://developer.hashicorp.com/terraform/install) |
| Akamai CLI | latest | `brew install akamai/tap/akamai` |
| k6 (load test) | latest | [k6.io](https://k6.io/docs/get-started/installation/) |
| openssl | any | bundled with most OS |

### 1. Clone and configure

```bash
git clone https://github.com/NolanKiwi/cms-akamai-platform.git
cd cms-akamai-platform
cp .env.example .env
# Edit .env — at minimum set OIDC_CLIENT_ID and OIDC_CLIENT_SECRET
```

### 2. One-command setup

```bash
make setup
```

This will:
- Generate JWT RS256 key pair (`./keys/`)
- Install all npm dependencies
- Start PostgreSQL, Redis, MinIO, OpenSearch via Docker Compose
- Run database migrations
- Seed development data

### 3. Start development servers

```bash
make dev
```

| Service | URL | Credentials |
|---|---|---|
| Web Frontend | http://localhost:3000 | public |
| CMS Admin Console | http://localhost:3001 | SSO login |
| CMS API | http://localhost:4000 | — |
| API Docs (Swagger) | http://localhost:4000/api/docs | — |
| MinIO Console | http://localhost:9001 | `cms_dev_access` / `cms_dev_secret_key_123` |
| Grafana | http://localhost:3100 | `admin` / `cms_dev_grafana` |
| Prometheus | http://localhost:9090 | — |
| OpenSearch Dashboards | http://localhost:5601 | `admin` / `CmsD3v@dm1n!` |
| Mailhog (email) | http://localhost:8025 | — |

---

## Architecture

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full system design.

```
Browser / Mobile
      │
 Akamai Edge (WAF + CDN + AMD + IVM)
      │ cache miss only
 Load Balancer
      ├── Next.js Frontend (SSR/ISR)
      └── NestJS CMS API
            │
            ├── PostgreSQL 16
            ├── Redis 7
            ├── S3 / MinIO
            └── OpenSearch
```

---

## Running Tests

```bash
# All tests
make test

# By type
make test-unit
make test-integration
make test-e2e

# Akamai staging validation (requires Akamai credentials + staging network)
AKAMAI_STAGING_HOST=staging.example.com make test-akamai

# Load test (requires k6 + running stack)
make test-load

# Security scan — STAGING ONLY, never production
TARGET_ENV=staging make test-security
```

---

## Cache Purge (Manual)

```bash
# Purge by cache tag
make purge-tags TAGS="article:uuid-123 listing:articles"

# Purge by URL
make purge-urls URLS="https://staging.example.com/articles/my-article"
```

Requires `AKAMAI_*` env vars. Prompts for confirmation on production.

---

## Infrastructure

```bash
# Staging — plan and apply
make infra-staging

# Production — plan only (apply manually after review)
make infra-prod
```

Terraform state is stored in S3 (configure `backend.tf` in each environment).

---

## Documentation Index

| Document | Description |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System overview, tech stack, diagram index |
| [DECISIONS.md](DECISIONS.md) | Architecture Decision Records |
| [TODO.md](TODO.md) | Phase-by-phase implementation task list |
| [NEXT_STEPS.md](NEXT_STEPS.md) | Immediate actions before development starts |
| [docs/01-executive-summary.md](docs/01-executive-summary.md) | Executive summary, MVP scope |
| [docs/02-high-level-architecture.md](docs/02-high-level-architecture.md) | All Mermaid diagrams + request flows |
| [docs/03-low-level-design.md](docs/03-low-level-design.md) | DB schema, content models, matrices |
| [docs/04-akamai-cdn-design.md](docs/04-akamai-cdn-design.md) | Full Akamai configuration guide |
| [docs/05-cms-functional-design.md](docs/05-cms-functional-design.md) | CMS workflows, admin console design |
| [docs/06-security-architecture.md](docs/06-security-architecture.md) | WAF, auth, origin protection |
| [docs/07-reporting-observability.md](docs/07-reporting-observability.md) | Observability stack, dashboards, SLOs |
| [docs/08-cache-purge-strategy.md](docs/08-cache-purge-strategy.md) | Cache invalidation strategy + code |
| [docs/09-streaming-media.md](docs/09-streaming-media.md) | VOD/live streaming, image optimization |
| [docs/10-database-api-design.md](docs/10-database-api-design.md) | Full API spec, DB schema |
| [docs/11-infrastructure-cicd.md](docs/11-infrastructure-cicd.md) | Terraform, CI/CD, Kubernetes |
| [docs/12-testing-qa.md](docs/12-testing-qa.md) | All test types, Akamai validation |
| [docs/13-phased-roadmap.md](docs/13-phased-roadmap.md) | Phase 0–9 roadmap |
| [docs/14-performance-targets.md](docs/14-performance-targets.md) | SLOs and performance targets |
| [docs/15-risk-register.md](docs/15-risk-register.md) | Risk matrix, open questions |
| [docs/16-repo-structure.md](docs/16-repo-structure.md) | Production checklist, runbooks |

---

## Phase Status

| Phase | Status | Description |
|---|---|---|
| Phase 0 | ⏳ Not Started | Discovery and requirements |
| Phase 1 | ⏳ Not Started | MVP CMS core |
| Phase 2 | ⏳ Not Started | Akamai static/dynamic delivery |
| Phase 3 | ⏳ Not Started | Publishing pipeline + cache purging |
| Phase 4 | ⏳ Not Started | Image/media optimization |
| Phase 5 | ⏳ Not Started | Streaming support |
| Phase 6 | ⏳ Not Started | Security hardening |
| Phase 7 | ⏳ Not Started | Reporting/analytics |
| Phase 8 | ⏳ Not Started | Production readiness |
| Phase 9 | ⏳ Not Started | Scale, multi-region, advanced edge |

---

## Contributing

1. Create a feature branch: `git checkout -b feature/phase1-cms-api`
2. Make changes with tests
3. Open a PR against `develop`
4. CI must pass: lint + typecheck + unit + integration tests
5. Akamai staging validation required for CDN-related changes
6. Manual review required for production activation

## License

Private — All rights reserved.
