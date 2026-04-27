# Next Steps

## Immediate Actions (This Week)

### 1. Akamai Contract Audit — CRITICAL
Contact your Akamai account team and confirm availability of:

| Product | Why Needed | Phase | Fallback if Unavailable |
|---|---|---|---|
| Ion (Standard or Premier) | Core delivery, SureRoute origin shield | 2 | Any CDN product — Ion is standard |
| App & API Protector | WAF + DDoS | 6 | Akamai Kona Site Defender (older) |
| Bot Manager | Bot protection | 6 | Rate limiting only |
| Adaptive Media Delivery (AMD) | Video streaming | 5 | S3 + Ion fallback (less optimized) |
| Image & Video Manager (IVM) | Image transformation | 4 | Pre-generate derivatives at origin |
| EdgeWorkers | Edge logic, redirect lookup, token auth | 3+ | Move logic to origin (higher latency) |
| EdgeKV | Edge configuration store | 3+ | Origin-side config API |
| DataStream 2 | Edge log export | 7 | Akamai Log Delivery Service (older) |
| Site Shield | Origin IP protection | 2 | Shared-secret header fallback |
| Fast Purge API (CCU v3) | Cache invalidation | 3 | Slower CCU v2 or URL-based only |
| HTTP/3 | Performance optimization | Optional | HTTP/2 only |

**Ask your Akamai TAM for:** Product list for your contract, CP code quota, EdgeWorker CPU/memory limits, EdgeKV read/write rate limits, DataStream 2 field list and delivery frequency.

---

### 2. Discovery Workshop Scheduling

Schedule 4 workshops within the next 2 weeks:

**Workshop 1: Editorial Requirements (2h)**
- Attendees: editors, publishers, content manager, product manager
- Agenda: Content types needed, current CMS pain points, workflow requirements, preview requirements, localization scope, scheduling frequency

**Workshop 2: Technical Architecture Review (2h)**
- Attendees: platform engineers, DevOps, Akamai TAM
- Agenda: Review this architecture document, confirm technology choices, identify integration dependencies, confirm Akamai entitlements

**Workshop 3: Security Review (1.5h)**
- Attendees: security architect, legal, platform lead
- Agenda: Origin protection approach, WAF configuration, GDPR scope, admin access controls, MFA enforcement

**Workshop 4: Operations and SLO Alignment (1.5h)**
- Attendees: DevOps, platform lead, management
- Agenda: Agree on SLO targets, on-call rotation, monitoring approach, incident severity definitions

---

### 3. Repository Bootstrap

```bash
# Create monorepo
npx create-turbo@latest cms-platform --package-manager npm

# Install core dependencies
cd cms-platform
npm install -D typescript @types/node

# Scaffold apps
npx create-next-app@latest apps/cms-admin --typescript --tailwind --app
npx create-next-app@latest apps/web-frontend --typescript --tailwind --app
cd apps && nest new cms-api --package-manager npm
nest new publisher-worker --package-manager npm
nest new purge-worker --package-manager npm

# Set up Terraform
mkdir -p infra/terraform/modules/{akamai-property,database,redis,s3,kubernetes}
mkdir -p infra/terraform/environments/{staging,production}

# Set up tests
mkdir -p tests/{e2e,load,security,akamai}
```

---

### 4. Infrastructure Provisioning (Staging)

After repository bootstrap, provision staging infrastructure:

```bash
cd infra/terraform/environments/staging
terraform init
terraform plan  # Review
terraform apply

# Creates:
# - EKS cluster (3 nodes, t3.medium)
# - RDS PostgreSQL 16 (db.t3.large)
# - ElastiCache Redis 7 (cache.t3.medium, cluster mode)
# - S3 buckets (media, logs, terraform state)
# - OpenSearch domain (t3.medium.search, 1 node)
# - ECR repositories for all app images
```

---

### 5. Akamai Terraform Setup

```bash
# Install Akamai CLI
brew install akamai/tap/akamai  # macOS
# OR: curl -sL https://raw.githubusercontent.com/akamai/cli/master/install-cli.sh | bash

# Set up .edgerc credentials
akamai auth

# Verify access
akamai property list

# Initialize Akamai Terraform
cd infra/terraform/environments/staging
terraform init
# Verify akamai provider loads correctly
terraform providers
```

---

## Architecture Clarifications Still Needed

Before Phase 2 begins, resolve these:

1. **Domain and DNS:** What is the primary domain? Who controls DNS (Route 53 / Cloudflare / other)? Is there an existing site to migrate from?

2. **Existing content:** Is there content to migrate from an existing CMS? What format? Volume estimate?

3. **Peak traffic estimate:** Expected concurrent users and requests/second at launch? (Determines EKS node sizing, Redis cluster size, origin shield aggressiveness)

4. **Video volume:** How many videos, average size, expected concurrent viewers? (Determines AMD sizing, S3 video bucket cost, transcoding queue sizing)

5. **Search requirements:** Full-text search of content? Autocomplete? Faceted filtering? (Determines OpenSearch index design)

6. **Third-party integrations:** Analytics (GA4? Adobe Analytics?), CRM, translation service, email notifications? (Affects Phase 1 webhook + API design)

---

## Key Files Reference

```
ARCHITECTURE.md          — This project's architecture overview and doc index
DECISIONS.md             — Architecture Decision Records
TODO.md                  — Phase-by-phase implementation tasks
NEXT_STEPS.md            — This file: immediate actions
docs/01-*.md             — Executive summary
docs/02-*.md             — High-level architecture + Mermaid diagrams
docs/03-*.md             — DB schema, content models, matrices
docs/04-*.md             — Akamai CDN configuration guide
docs/05-*.md             — CMS functional design
docs/06-*.md             — Security architecture
docs/07-*.md             — Observability stack
docs/08-*.md             — Cache + purge strategy + code
docs/09-*.md             — Streaming and media
docs/10-*.md             — Database and API design
docs/11-*.md             — Infrastructure, Terraform, CI/CD, repo structure
docs/12-*.md             — Testing strategy
docs/13-*.md             — Phased roadmap
docs/14-*.md             — Performance targets
docs/15-*.md             — Risk register + open questions
docs/16-*.md             — Production readiness checklist + runbooks
infra/terraform/         — Terraform modules (Akamai, database, redis, k8s)
infra/akamai/            — Akamai rule JSON, EdgeWorker source code
tests/akamai/            — Akamai staging validation scripts
```

---

## Estimated Effort Summary

| Phase | Duration | Key Dependencies |
|---|---|---|
| Phase 0 | 2 weeks | Stakeholder availability, Akamai TAM access |
| Phase 1 | 6 weeks | Cloud credentials, OIDC provider |
| Phase 2 | 4 weeks | Akamai contract confirmation, domain |
| Phase 3 | 3 weeks | Phase 2 complete |
| Phase 4 | 4 weeks | IVM entitlement confirmed |
| Phase 5 | 6 weeks | AMD entitlement, transcoding choice |
| Phase 6 | 4 weeks | App & API Protector entitlement, security review |
| Phase 7 | 4 weeks | DataStream 2 entitlement |
| Phase 8 | 4 weeks | All prior phases complete |
| **MVP (0-3)** | **~15 weeks** | |
| **Full platform (0-8)** | **~37 weeks** | |
