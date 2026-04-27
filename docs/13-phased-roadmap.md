# Phased Implementation Roadmap

---

## Phase 0: Discovery and Requirements

**Duration:** 2 weeks  
**Goal:** Establish shared understanding and de-risk the architecture before writing code.

### Tasks
- [ ] Stakeholder workshops: editorial team, dev team, marketing, legal, security
- [ ] Audit existing CMS (if migrating) and document content models
- [ ] Define supported content types, locales, sites
- [ ] Confirm Akamai contract: identify which products are available (Ion, AMD, IVM, Bot Manager, DataStream 2, EdgeWorkers, Site Shield)
- [ ] Identify media volume, upload frequency, video usage requirements
- [ ] Confirm cloud provider (AWS assumed) and region(s)
- [ ] Review GDPR/data residency requirements
- [ ] Document existing redirect inventory
- [ ] Identify third-party integrations (analytics, search, ad platforms, translation)
- [ ] Define SLOs (use values in 14-performance-targets.md as starting point)
- [ ] Confirm domain strategy and DNS provider
- [ ] Set up monorepo, Turborepo, base CI/CD skeleton

### Required Inputs
- Content type list + sample content
- Existing site URLs and traffic volumes
- Akamai contract details (product codes, CPCodes to provision)
- Cloud credentials and networking topology
- List of OIDC providers for SSO

### Exit Criteria
- Architecture Decision Records (ADRs) written and signed off
- Content model schema documented
- Akamai product entitlement list confirmed
- Infrastructure cost estimate approved
- Team onboarded to monorepo and CI/CD

### Risks
- **Akamai entitlement gaps:** Key features (AMD, IVM, Bot Manager) may not be in contract → fallback designs selected
- **Content model complexity:** Overly complex models slow Phase 1 → limit initial types, extend later

---

## Phase 1: MVP CMS Core

**Duration:** 6 weeks  
**Goal:** Working CMS with admin console, RBAC, basic content CRUD, draft workflow, and local development environment.

### Tasks
- [ ] Provision dev/staging infrastructure (Terraform: RDS, Redis, S3, EKS)
- [ ] NestJS CMS API: skeleton, health checks, auth, RBAC
- [ ] PostgreSQL schema: sites, users, roles, content_types, content_entries, content_versions
- [ ] Implement content CRUD endpoints (create, read, update, delete, version history)
- [ ] Editorial workflow: draft → in_review → published → archived state machine
- [ ] Next.js admin console: login, dashboard, content list, edit form (basic fields)
- [ ] OIDC SSO integration (Google Workspace or Okta)
- [ ] S3 integration: presigned upload, MIME validation, EXIF strip
- [ ] Redis: session management, rate limiting
- [ ] Audit log: all mutations recorded
- [ ] Unit tests: 80% coverage on CMS API modules
- [ ] Integration tests: all CRUD + workflow endpoints
- [ ] Docker Compose for local development
- [ ] GitHub Actions: lint, typecheck, unit tests, Docker build

### Exit Criteria
- Editor can log in, create article draft, submit for review
- Publisher can approve and publish article
- Version history visible; rollback works
- Admin console loads < 3s on local
- All unit and integration tests pass
- Docker Compose brings up entire stack locally

### QA Checklist
- [ ] RBAC: editor cannot publish; viewer cannot create
- [ ] Site isolation: user cannot access other site's content
- [ ] Audit log captures all mutations with correct user/timestamp
- [ ] Rollback creates new version (not overwrite)
- [ ] Scheduled publish fires within 65s of scheduled time

### Security Checklist
- [ ] JWT signed with RS256, expires 8h
- [ ] Admin endpoints require auth; public endpoints do not return unpublished content
- [ ] MIME validation rejects .exe, .html uploads
- [ ] SQL queries use parameterized queries (no string interpolation)
- [ ] Secrets loaded from environment; not hardcoded

---

## Phase 2: Akamai Static and Dynamic Delivery

**Duration:** 4 weeks  
**Goal:** Public website live behind Akamai with proper caching for static and dynamic content.

### Tasks
- [ ] Provision Akamai property: `cms-production-www` (Terraform)
- [ ] Configure CP codes: WEB-STATIC, WEB-DYNAMIC, WEB-API
- [ ] Configure edge hostnames, TLS certificates (Akamai CPS)
- [ ] Define rule hierarchy in Terraform (PAPI JSON):
  - HTTPS redirect
  - Static asset rules (365d TTL, no cookies)
  - Dynamic HTML rules (Surrogate-Control from origin)
  - Public API caching rules
  - Admin path deny rule
- [ ] Origin protection: Site Shield IPs in security group (or shared-secret fallback)
- [ ] Security headers injection rule (HSTS, X-Frame-Options, etc.)
- [ ] HTTP → HTTPS redirect rule
- [ ] Stale-while-revalidate (serve stale on origin error up to 1h)
- [ ] Compression: brotli + gzip
- [ ] Next.js frontend: ISR pages emit Surrogate-Control + Surrogate-Key headers
- [ ] CMS API public endpoints: emit Surrogate-Control + Surrogate-Key headers
- [ ] Activate on Akamai STAGING, validate all cache behaviors
- [ ] DNS: CNAME staging subdomain to Akamai edge hostname
- [ ] Smoke test: static hit ratio > 90% after warm-up, dynamic pages return correctly

### Exit Criteria
- All traffic routed through Akamai
- Static assets cached > 95% hit ratio (after warm-up)
- Dynamic pages cached with correct TTL and surrogate keys
- Security headers present on all responses
- Admin paths blocked at edge (403)
- Origin not directly reachable (Site Shield or shared secret enforced)

### Akamai Validation Checklist
- [ ] `X-Check-Cacheable: YES` on second request for static assets
- [ ] Surrogate-Key header present on dynamic responses
- [ ] No cookies forwarded to cache for public pages
- [ ] HTTP 301 redirect to HTTPS working
- [ ] Brotli encoding confirmed (`Content-Encoding: br`)
- [ ] Admin path returns 403 from edge

### Performance Checklist
- [ ] Static TTFB from edge < 50ms
- [ ] LCP on homepage < 2.5s (synthetic test)
- [ ] Cache hit ratio static > 95%

---

## Phase 3: Publishing Pipeline and Cache Purging

**Duration:** 3 weeks  
**Goal:** End-to-end publish → purge → live content flow with audit trail and monitoring.

### Tasks
- [ ] BullMQ queue setup: publish-queue, purge-queue, webhook-queue
- [ ] Publisher worker: execute publish state machine, update DB, emit events
- [ ] Purge worker: consume events, resolve dependency graph, call Akamai Fast Purge API
- [ ] Purge client: tag purge + URL purge + polling for completion
- [ ] Purge log: write to purge_log table, expose in admin console
- [ ] Cache tag generation: implement generateCacheTags() for all content types
- [ ] Surrogate-Key header injection in all public endpoints
- [ ] Webhook worker: deliver content.published events to configured endpoints
- [ ] Search indexer: index published content to OpenSearch
- [ ] Admin console: publish button → status tracking → purge confirmation
- [ ] Emergency purge UI: manual tag/URL purge with confirmation
- [ ] Grafana dashboard: publishing pipeline metrics
- [ ] Alert: publish latency > 60s → PagerDuty
- [ ] End-to-end test: publish → purge confirmed within 30s

### Exit Criteria
- 95% of publishes complete full purge cycle in < 30s
- Purge log shows all purge events with latency
- Failed purges retry and alert operator
- Webhooks delivered with HMAC signature
- Content appears on public site within 30s of publish

### Performance Checklist
- [ ] P95 publish-to-live latency < 30s
- [ ] Purge queue depth < 10 during normal publishing
- [ ] No purge failures under normal load

---

## Phase 4: Image and Media Optimization

**Duration:** 4 weeks  
**Goal:** Full DAM capability with IVM-powered image optimization and responsive delivery.

### Tasks
- [ ] Provision `cms-production-media` Akamai property
- [ ] Configure IVM policy: WebP/AVIF negotiation, quality, strip EXIF, focal point
- [ ] S3 media bucket: originals, thumbnails, documents structure
- [ ] CMS API: presigned upload, MIME validation, malware scan integration
- [ ] Image metadata extraction (sharp): dimensions, format, colorspace
- [ ] Thumbnail generation (sharp): 400x300, OG image 1200x630
- [ ] Focal point storage and crop hint passing to IVM
- [ ] Admin console: DAM browser, drag-and-drop upload, metadata editor, focal point UI
- [ ] Content type fields: media_reference type, image picker component
- [ ] CDN URL generation for all media assets
- [ ] Asset cache tag linking to referencing content
- [ ] Test: WebP served to modern browsers, JPEG to old
- [ ] Test: image purged when asset updated (via asset:{id} tag)

### Exit Criteria
- Editors can upload images, set alt text and focal point
- WebP/AVIF served based on Accept header
- Responsive image srcset generated by frontend
- Image cache hit ratio > 90%
- Malware scan rejects known-bad test file

---

## Phase 5: Streaming Support (VOD)

**Duration:** 6 weeks  
**Goal:** VOD HLS delivery with geo restriction and token auth via Akamai AMD.

### Tasks
- [ ] Provision `cms-production-streams` Akamai AMD property
- [ ] Transcoding pipeline: AWS MediaConvert integration
- [ ] S3 buckets: video source, video processed (HLS output)
- [ ] CMS API: video registration, upload URL, completion webhook
- [ ] video_assets table: hls_url, dash_url, status, geo_restriction, token_required
- [ ] Token auth: EdgeWorker for HMAC token validation
- [ ] Geo restriction: EdgeKV lookup in EdgeWorker
- [ ] Admin console: video management, thumbnail selection, geo/token config
- [ ] Frontend: HLS.js player integration with token fetch
- [ ] Streaming metrics: manifest/segment requests, token failures
- [ ] Live streaming architecture design (implementation Phase 5b)

### Exit Criteria
- Video plays in browser via HLS
- Token auth blocks requests without valid token (403)
- Geo restriction blocks correct countries (test with Akamai geo spoofing headers on staging)
- Segment cache hit ratio > 80% after warm-up

---

## Phase 6: Security Hardening

**Duration:** 4 weeks  
**Goal:** Full WAF, Bot Manager, rate limiting, and security monitoring operational.

### Tasks
- [ ] Akamai WAF: configure App & API Protector policy in alert mode
- [ ] WAF tuning: 2 weeks in alert mode, identify false positives
- [ ] WAF switch to deny mode after tuning
- [ ] Bot Manager: configure for login, search, upload endpoints `[ENTITLEMENT]`
- [ ] Rate limiting: Akamai Edge Rate Control (or Redis-based fallback)
- [ ] CSP: implement nonce-based CSP, report-only first, then enforce
- [ ] Admin IP allowlist: configure in Akamai + application layer
- [ ] MFA enforcement: verify OIDC provider enforces MFA
- [ ] Secret rotation: document and test rotation procedures
- [ ] OWASP ZAP: baseline scan on staging, zero HIGH/CRITICAL
- [ ] Penetration test: engage security team or third party for review
- [ ] Security incident response runbook written
- [ ] Grafana security dashboard operational

### Exit Criteria
- WAF in deny mode with < 0.1% false positive rate
- OWASP ZAP zero HIGH/CRITICAL findings
- Origin unreachable without Akamai
- All secrets stored in Vault/Secrets Manager
- Security incident runbook reviewed by security lead

---

## Phase 7: Reporting and Analytics

**Duration:** 4 weeks  
**Goal:** DataStream 2 edge logs flowing into OpenSearch, all Grafana dashboards operational.

### Tasks
- [ ] Configure DataStream 2: all production CP codes → S3
- [ ] Fluent Bit pipeline: S3 → OpenSearch
- [ ] OpenSearch index templates and ILM policies
- [ ] Grafana dashboards: Operations, Security, Editorial, Business
- [ ] RUM implementation: web-vitals → /api/v1/rum → OpenSearch
- [ ] Prometheus alerting rules: all SLO alerts
- [ ] Alertmanager → PagerDuty integration
- [ ] Daily digest: purge activity, traffic summary → Slack
- [ ] Editorial reports: publish latency, content velocity
- [ ] Streaming metrics dashboard (after Phase 5)

### Exit Criteria
- Edge logs appearing in OpenSearch within 5 minutes of request
- All 4 Grafana dashboards rendering correctly
- All SLO alerts tested (manually trigger violation, confirm PagerDuty fires)
- Business dashboard accessible to management (read-only Grafana user)

---

## Phase 8: Production Readiness

**Duration:** 4 weeks  
**Goal:** Hardened, documented, monitored production environment ready for launch.

### Tasks
- [ ] Load test: 50 concurrent publishers, 500 concurrent readers (k6)
- [ ] Chaos testing: kill one app pod, verify traffic reroutes (Kubernetes HPA)
- [ ] DR test: failover PostgreSQL to replica, verify app continues
- [ ] Backup/restore test: restore from backup to clean environment
- [ ] Origin failover test: block primary origin, verify Akamai fails to secondary
- [ ] DNS cutover rehearsal: test with low TTL on staging domain
- [ ] Runbook review: all operational runbooks reviewed by team
- [ ] On-call rotation: team scheduled, PagerDuty configured
- [ ] Capacity planning: estimate peak traffic (launch day), scale accordingly
- [ ] Content migration: migrate existing content from old CMS (if applicable)
- [ ] SEO validation: crawl staging, compare with production
- [ ] Accessibility audit: external accessibility review
- [ ] Security pen test sign-off
- [ ] Launch readiness checklist reviewed and signed off by stakeholders

### Exit Criteria
- Load test passes at 2x expected peak traffic
- All runbooks reviewed and accessible
- Monitoring operational for 2 weeks (no unresolved alerts)
- Backup/restore tested successfully
- Green light from security, performance, editorial leads

---

## Phase 9: Scale, Multi-Region, and Advanced Edge

**Duration:** Ongoing (post-launch)  
**Goal:** Advanced features for scale and personalization.

### Tasks
- [ ] Multi-region origin: eu-west-1 replica + Akamai origin failover
- [ ] EdgeWorkers A/B testing framework
- [ ] EdgeKV feature flags: replace hard-coded config
- [ ] Live streaming: RTMP ingest, Wowza/Elemental, DVR support
- [ ] SSAI framework: integrate ad insertion for premium content
- [ ] ClickHouse or BigQuery for long-term analytics (beyond OpenSearch 90d)
- [ ] Personalized content delivery (edge-computed, no PII at edge)
- [ ] Advanced image optimization: AVIF generation, adaptive quality
- [ ] GraphQL API (complement to REST)
- [ ] Translation workflow integration (Phrase, Lokalise, or custom)
- [ ] Advanced search: faceted search, typo tolerance, personalized ranking
- [ ] Content API rate limit tiers (enterprise API keys)
- [ ] Global redirect CDN for legacy URL preservation

---

## Launch Go/No-Go Checklist

```
Technical
  [ ] All Phase 0-8 exit criteria met
  [ ] Zero P0/P1 open issues
  [ ] Load test passed at 2x peak
  [ ] Security pen test signed off
  [ ] Backup/restore tested in last 30 days
  [ ] DNS cutover plan rehearsed

Operational
  [ ] All runbooks written and reviewed
  [ ] On-call rotation active
  [ ] PagerDuty escalation policy configured
  [ ] Grafana dashboards operational
  [ ] DataStream logs flowing to OpenSearch

Editorial
  [ ] Content migrated and verified
  [ ] Editorial team trained on new CMS
  [ ] Preview environment working
  [ ] Scheduled publishes tested

Akamai
  [ ] All properties activated to PRODUCTION
  [ ] Purge test confirmed < 10s
  [ ] WAF in deny mode
  [ ] Security headers verified from production edge
  [ ] DataStream 2 streaming from production CP codes

Business
  [ ] SEO migration plan in place (redirects from old URLs)
  [ ] Analytics continuity plan (no data gap)
  [ ] Legal/privacy review complete
  [ ] Stakeholder sign-off received
```
