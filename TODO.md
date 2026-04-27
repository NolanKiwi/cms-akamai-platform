# Implementation TODO

## Phase 0: Discovery (2 weeks) — NEXT
- [ ] Schedule stakeholder workshops (editorial, dev, legal, security, marketing)
- [ ] Confirm Akamai contract entitlements (critical: AMD, IVM, Bot Manager, EdgeWorkers, DataStream 2, Site Shield)
- [ ] Audit existing CMS (if any) — extract content types and redirects
- [ ] Confirm cloud provider regions and networking topology
- [ ] Confirm OIDC/SSO provider (Google Workspace / Okta / Azure AD)
- [ ] Define supported content types and locales
- [ ] Review GDPR / data residency requirements
- [ ] Confirm domain strategy and DNS provider
- [ ] Review performance targets with business stakeholders
- [ ] Obtain Akamai API credentials (PAPI for Terraform, Fast Purge API, EdgeKV API)
- [ ] Set up GitHub org, monorepo skeleton, branch protection rules
- [ ] Set up AWS accounts (dev, staging, production) with separate IAM
- [ ] Confirm video transcoding approach (AWS MediaConvert vs Mux vs FFmpeg)

## Phase 1: MVP CMS Core (6 weeks)
- [ ] Provision staging infrastructure (Terraform: RDS, Redis, S3, EKS, OpenSearch)
- [ ] NestJS CMS API scaffold: health, auth, RBAC modules
- [ ] PostgreSQL schema: apply all migrations from docs/03-low-level-design.md
- [ ] Content CRUD: create, read, update, archive, version history
- [ ] Editorial workflow state machine: draft → in_review → published → archived
- [ ] Next.js admin console: login (OIDC), dashboard, content list, form editor
- [ ] OIDC SSO integration
- [ ] S3 integration: presigned upload URL, MIME validation
- [ ] Redis: session management, rate limiting (NestJS throttler)
- [ ] Audit log: all mutations captured
- [ ] Docker Compose for full local stack
- [ ] Unit tests: 80% coverage target
- [ ] Integration tests: all CRUD + workflow endpoints
- [ ] GitHub Actions: CI pipeline (lint, typecheck, test, build)

## Phase 2: Akamai Static/Dynamic Delivery (4 weeks)
- [ ] Terraform: Akamai property `cms-production-www` + CP codes
- [ ] Configure rule hierarchy (static, dynamic, API, admin deny, health bypass)
- [ ] TLS certificates via Akamai CPS
- [ ] Origin protection: Site Shield firewall rule (or shared-secret fallback)
- [ ] Security headers injection rule
- [ ] HTTP → HTTPS redirect rule
- [ ] Stale-while-revalidate configuration
- [ ] Brotli + gzip compression
- [ ] Surrogate-Control + Surrogate-Key headers in Next.js frontend and NestJS API
- [ ] Akamai staging activation and validation
- [ ] Cache behavior tests: static hit ratio, security headers, redirects
- [ ] DNS: CNAME staging subdomain to Akamai edge

## Phase 3: Publishing Pipeline and Purge (3 weeks)
- [ ] BullMQ queues: publish, purge, webhook, search
- [ ] Publisher worker: state machine execution, DB update, event emit
- [ ] Purge worker: tag dependency resolution, Akamai Fast Purge API calls
- [ ] Akamai Fast Purge client (packages/akamai-client)
- [ ] Cache tag generation for all content types
- [ ] Purge log: purge_log table + admin console UI
- [ ] Webhook worker: HMAC-signed delivery + retry
- [ ] Search indexer: OpenSearch index on publish
- [ ] Emergency purge UI in admin console
- [ ] Grafana dashboard: publishing pipeline metrics
- [ ] End-to-end test: publish → cache miss within 30s

## Phase 4: Image/Media Optimization (4 weeks)
- [ ] Akamai property: `cms-production-media` + IVM policy
- [ ] S3 media buckets (originals, thumbnails, documents)
- [ ] CMS API: presigned upload, MIME re-validation, malware scan
- [ ] Image processing: sharp (dimensions, EXIF strip, thumbnail generation)
- [ ] Focal point: storage in DB, crop hint to IVM
- [ ] Admin console: DAM browser, upload UI, metadata editor, focal point picker
- [ ] Content type fields: media_reference, image picker
- [ ] Asset cache tag linking to referencing content
- [ ] WebP/AVIF delivery test

## Phase 5: Streaming VOD (6 weeks)
- [ ] Akamai AMD property: `cms-production-streams`
- [ ] AWS MediaConvert integration (or Mux)
- [ ] S3 buckets: video-source, video-processed
- [ ] CMS API: video registration, upload URL, transcode webhook
- [ ] video_assets DB table
- [ ] EdgeWorker: token auth validation (HMAC)
- [ ] EdgeKV: geo restriction data sync
- [ ] Admin console: video management UI, thumbnail selector
- [ ] HLS.js player in frontend
- [ ] Streaming metrics in Grafana

## Phase 6: Security Hardening (4 weeks)
- [ ] WAF policy: App & API Protector, alert mode 2 weeks then deny
- [ ] Bot Manager: login, search, upload endpoints
- [ ] Rate limiting: Akamai Edge Rate Control
- [ ] CSP: nonce-based, report-only then enforce
- [ ] Admin IP allowlist
- [ ] OWASP ZAP baseline scan on staging
- [ ] Secret rotation procedures documented and tested
- [ ] Security incident response runbook
- [ ] Security dashboard in Grafana

## Phase 7: Reporting (4 weeks)
- [ ] DataStream 2: configure all production CP codes → S3
- [ ] Fluent Bit: S3 → OpenSearch pipeline
- [ ] OpenSearch index templates + ILM
- [ ] Grafana dashboards: Operations, Security, Editorial, Business
- [ ] RUM: web-vitals.js → /api/v1/rum endpoint
- [ ] Prometheus alerting rules (all SLOs)
- [ ] PagerDuty integration
- [ ] Daily Slack digest

## Phase 8: Production Readiness (4 weeks)
- [ ] Load test: k6, 50 concurrent publishers + 500 readers
- [ ] Chaos test: pod failure, DB failover
- [ ] DR test: restore from backup
- [ ] DNS cutover rehearsal
- [ ] All runbooks written and reviewed
- [ ] On-call rotation configured
- [ ] Content migration (if applicable)
- [ ] SEO validation against staging
- [ ] Accessibility audit
- [ ] Launch go/no-go checklist signed off

## Phase 9: Scale and Advanced Edge (Ongoing)
- [ ] Multi-region origin (eu-west-1)
- [ ] EdgeWorkers A/B testing
- [ ] EdgeKV feature flags
- [ ] Live streaming
- [ ] SSAI framework
- [ ] ClickHouse/BigQuery long-term analytics
- [ ] GraphQL API
- [ ] Translation workflow integration

---

## Blockers (Require External Input)

| Blocker | Impact | Owner |
|---|---|---|
| Akamai contract entitlement confirmation | Blocks Phase 2+ feature selection | Account team |
| OIDC provider selection | Blocks Phase 1 auth | Platform lead |
| Video transcoding approach | Blocks Phase 5 | Platform lead |
| GDPR data residency requirements | Blocks multi-region design | Legal |
| DNS provider API access | Blocks Phase 2 DNS cutover | Ops |
