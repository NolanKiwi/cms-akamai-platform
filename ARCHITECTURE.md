# CMS Platform Architecture

## Document Index

| Document | Purpose |
|---|---|
| [01 - Executive Summary](docs/01-executive-summary.md) | 1-page overview, benefits, risks, MVP scope |
| [02 - High-Level Architecture](docs/02-high-level-architecture.md) | Mermaid diagrams, all request flows |
| [03 - Low-Level Design](docs/03-low-level-design.md) | DB schema, content models, cache/TTL/purge tag matrices, security matrix |
| [04 - Akamai CDN Design](docs/04-akamai-cdn-design.md) | Property structure, CP codes, rule hierarchy, EdgeWorkers, Fast Purge |
| [05 - CMS Functional Design](docs/05-cms-functional-design.md) | Admin console, workflow state machine, preview, DAM, multi-locale |
| [06 - Security Architecture](docs/06-security-architecture.md) | WAF, origin protection, auth, CSP, upload security, incident response |
| [07 - Reporting & Observability](docs/07-reporting-observability.md) | DataStream 2 pipeline, Prometheus, Grafana dashboards, SLOs, alerting |
| [08 - Cache & Purge Strategy](docs/08-cache-purge-strategy.md) | Invalidate vs delete, tag model, dependency graph, purge worker code |
| [09 - Streaming & Media](docs/09-streaming-media.md) | VOD/live workflow, HLS delivery, IVM, geo restriction, SSAI hooks |
| [10 - Database & API Design](docs/10-database-api-design.md) | Full SQL schema, complete API specs, rate limiting |
| [11 - Infrastructure & CI/CD](docs/11-infrastructure-cicd.md) | Repo structure, Terraform modules, GitHub Actions pipeline, blue/green |
| [12 - Testing & QA](docs/12-testing-qa.md) | Unit, integration, Akamai staging, E2E, load, security, SEO, a11y tests |
| [13 - Phased Roadmap](docs/13-phased-roadmap.md) | Phase 0–9 with tasks, exit criteria, QA/security/perf checklists |
| [14 - Performance Targets](docs/14-performance-targets.md) | SLO table, all performance metrics and measurement strategy |
| [15 - Risk Register](docs/15-risk-register.md) | Risk matrix, top risk detail sheets, open questions |
| [16 - Repo Structure & Runbooks](docs/16-repo-structure.md) | Production readiness checklist, operational runbooks, ADR index |

## Technology Stack

```
Frontend          Next.js 14 (App Router, ISR)
CMS API           NestJS (Node.js / TypeScript)
Admin Console     Next.js 14 + shadcn/ui
Workers           NestJS (BullMQ consumers)
Database          PostgreSQL 16 (Primary + Read Replica)
Cache             Redis 7 Cluster
Object Storage    AWS S3
Search            OpenSearch
Queue             BullMQ (Redis-backed) → Kafka at scale
CDN               Akamai (Ion, AMD, IVM, App & API Protector)
Edge Logic        Akamai EdgeWorkers + EdgeKV
IaC               Terraform + Akamai Provider
CI/CD             GitHub Actions
Observability     OpenTelemetry → Prometheus/Grafana + OpenSearch
```

## Architecture Diagram (Summary)

```
Browser / Mobile / Player
         │
    ┌────▼─────────────────────────────────────┐
    │  Akamai Edge Network                      │
    │  WAF + Bot + DDoS + CDN + AMD + IVM       │
    └────┬─────────────────────────────────────┘
         │ Cache miss only (>90% served from edge)
    ┌────▼─────────────────────────────────────┐
    │  Origin (protected by Site Shield IPs)   │
    │  Load Balancer → Next.js / NestJS         │
    └────┬─────────────────────────────────────┘
         │
    ┌────▼─────────────────────────────────────┐
    │  Data Layer                               │
    │  PostgreSQL + Redis + S3 + OpenSearch     │
    └──────────────────────────────────────────┘
         │
    ┌────▼─────────────────────────────────────┐
    │  Async Workers                            │
    │  Publish → Purge → Search Index →Webhook  │
    └──────────────────────────────────────────┘
```

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Purge strategy | Invalidate by tag (default) | Graceful; supports dependency fan-out |
| Cache key | Path + device + locale (normalized) | Balances hit ratio vs variation |
| Auth | RS256 JWT + OIDC/SSO + MFA | Secure, stateless, enterprise-compatible |
| Origin protection | Site Shield IP allowlist + shared secret | Defense in depth |
| Queue | BullMQ (Redis) → Kafka upgrade path | MVP simplicity; Kafka when publish volume > 1k/min |
| Media storage | S3 (originals) + Akamai IVM (derivatives) | No pre-generation waste; CDN-level transform |
| Search | OpenSearch | Combined search + log analytics on one platform |
| Streaming | Akamai AMD + pre-packaged HLS | Maximum edge cache efficiency for segments |
