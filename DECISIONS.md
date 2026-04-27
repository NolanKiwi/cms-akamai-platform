# Architecture Decision Records

## ADR-001: Next.js 14 for Public Frontend

**Status:** Accepted  
**Decision:** Use Next.js 14 (App Router) with ISR (Incremental Static Regeneration) for the public-facing website.  
**Rationale:**
- ISR generates static HTML at build or on-demand, served directly by Akamai — no SSR origin hit for cached pages
- `next/image` provides built-in srcset generation and loader integration with IVM
- App Router enables React Server Components for reduced client bundle size
- Large ecosystem, widespread CMS integration patterns
- Surrogate-Key headers emitted per-page for tag-based purging

**Rejected alternatives:** Nuxt 3 (smaller Next.js parity in ISR/RSC space at time of decision), SvelteKit (smaller team familiarity), Remix (less ISR-native CDN caching story)

---

## ADR-002: NestJS for CMS API

**Status:** Accepted  
**Decision:** NestJS (Node.js/TypeScript) for the CMS API.  
**Rationale:**
- Module system enforces clean separation of concerns (content, auth, assets, video, purge as modules)
- Built-in OpenAPI/Swagger generation — produces API spec for Akamai API definition and contract tests
- BullMQ, TypeORM, and OpenTelemetry integrations are first-class
- TypeScript shared types across API + admin console + workers in the monorepo
- Performance: Node.js handles I/O-heavy CMS workloads efficiently

**Rejected alternatives:** Go (faster raw performance but less relevant for CMS I/O workload; team onboarding cost), Java/Spring (more verbose for this use case; container overhead), FastAPI/Python (less TypeScript monorepo synergy)

---

## ADR-003: BullMQ Over Kafka for MVP Queue

**Status:** Accepted (with upgrade path)  
**Decision:** Use BullMQ (Redis-backed) for the publish, purge, search, and webhook queues in MVP.  
**Rationale:**
- BullMQ reuses the existing Redis cluster — no additional infrastructure
- Built-in delayed jobs (scheduled publish), retries, dead-letter queues, concurrency control
- Simple monitoring via BullMQ dashboard or custom Prometheus metrics
- Sufficient for expected MVP publish volume (< 100 publishes/minute)

**Upgrade path to Kafka:**
- When publish volume > 500/minute OR multiple consumers need replay/fan-out
- Migration: replace BullMQ producer/consumer with Kafka producers/consumers
- Interface abstraction (`EventBus`) in `packages/shared-types` decouples application code from queue implementation

---

## ADR-004: OpenSearch for Both Search and Log Analytics

**Status:** Accepted  
**Decision:** Single OpenSearch domain for CMS content search and Akamai edge log analytics.  
**Rationale:**
- Reduces operational overhead (one cluster to manage, one backup, one monitoring setup)
- Log analytics queries (Grafana datasource) and content search queries are separated by index prefix
- ILM policies applied differently per index pattern
- At scale, can split into separate domains for isolation

**Trade-offs:**
- Noisy neighbor risk between search and log workloads → mitigated by separate node groups (data tier separation in production)
- OpenSearch less specialized than Meilisearch for typo tolerance — acceptable for Phase 1-7; Meilisearch considered for Phase 9 if editorial search quality suffers

---

## ADR-005: Tag Purge as Default, URL Purge as Fallback

**Status:** Accepted  
**Decision:** Use Akamai cache tag (Surrogate-Key) purge as the default invalidation mechanism.  
**Rationale:**
- A single tag purge can invalidate all pages that embed a changed article without enumerating URLs
- URL purge requires listing all locale/device/pagination variants — error-prone
- Tag purge is idempotent and safe to retry

**When URL purge is used:**
- Emergency: operator explicitly purges specific URL
- When tag is not available (e.g., external CDN or CDN without tag support)
- For initial warm-up validation

---

## ADR-006: Invalidate Over Delete

**Status:** Accepted  
**Decision:** Default all purge operations to `invalidate` rather than `delete`.  
**Rationale:**
- Invalidate: marks cached object stale; next request re-fetches while other nodes serve stale
- Delete: immediately removes object; next requests all go to origin simultaneously (thundering herd risk)
- Invalidate provides graceful transition with minimal origin load
- Delete reserved for: GDPR right-to-erasure, security incidents, legally required immediate removal

---

## ADR-007: S3 for Media Origin (Not Akamai NetStorage)

**Status:** Accepted (revisit for streaming)  
**Decision:** AWS S3 for media asset storage. Consider Akamai NetStorage for streaming segments.  
**Rationale:**
- S3 is cloud-native, well-integrated with AWS ecosystem (IAM, lifecycle, replication)
- Developer familiarity is higher
- Akamai can serve S3 as origin with SureRoute (origin shield) for performance
- For VOD segments specifically: NetStorage co-location with AMD PoPs may improve first-segment latency significantly — evaluate in Phase 5

**NetStorage consideration:** If Phase 5 streaming tests show unacceptable first-segment latency from S3 origin, migrate video processed output to NetStorage.

---

## ADR-008: PostgreSQL Over MySQL

**Status:** Accepted  
**Decision:** PostgreSQL 16.  
**Rationale:**
- JSONB with GIN indexes: content type field definitions and versioned content stored as JSONB — PostgreSQL JSONB is significantly more capable than MySQL JSON
- Advanced full-text search (ts_vector, GIN indexes)
- Row-level security and rich extension ecosystem
- `pg_trgm` for trigram similarity search in admin console
- `CREATE INDEX CONCURRENTLY` for zero-downtime index changes

---

## ADR-009: Monorepo with Turborepo

**Status:** Accepted  
**Decision:** Turborepo-managed monorepo for all CMS platform code.  
**Rationale:**
- Shared TypeScript types between CMS API, admin console, workers, and packages without npm publishing overhead
- Turborepo build caching: CI builds only affected packages on PR (significant CI time savings)
- Single repository for security patches (update dependency once, apply everywhere)
- Simplified local development (single `turbo dev` runs all services)

**Trade-offs:**
- Larger clone size — acceptable
- Single PR can affect multiple services — requires per-service E2E tests in CI

---

## ADR-010: GitHub Actions for CI/CD

**Status:** Accepted  
**Decision:** GitHub Actions as the CI/CD platform.  
**Rationale:**
- Native integration with GitHub PRs, branch protection, and secrets
- Marketplace actions for AWS, Akamai, Docker
- OIDC-based AWS authentication (no static IAM keys in CI)
- Sufficient parallelism for monorepo matrix builds

---

## Open Decisions (Requires Input)

| Decision | Options | Pending Input |
|---|---|---|
| Video transcoding | AWS MediaConvert vs Mux vs self-hosted FFmpeg | Cost analysis, operational preference |
| OIDC provider | Google Workspace vs Okta vs Azure AD | Enterprise SSO provider confirmation |
| Multi-region | US-only vs US+EU | GDPR/data residency requirements |
| Analytics store (long-term) | OpenSearch only vs ClickHouse vs BigQuery | Volume estimates, query patterns |
| Streaming ingest | Wowza vs Nginx-RTMP vs Elemental | Live streaming requirements confirmed |
