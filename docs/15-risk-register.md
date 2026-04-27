# Risk Register

## Risk Scoring
- **Likelihood:** 1 (Rare) → 5 (Almost Certain)
- **Impact:** 1 (Negligible) → 5 (Critical)
- **Score:** Likelihood × Impact

| ID | Risk | L | I | Score | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R01 | Cache Poisoning | 2 | 5 | 10 | Query normalization, cookie stripping, validated cache keys | Platform |
| R02 | Personalized data cached publicly | 2 | 5 | 10 | Cookie-based bypass, private Cache-Control, Vary rules, integration test | Platform |
| R03 | Origin bypass (Akamai circumvented) | 2 | 5 | 10 | Site Shield IP allowlist in firewall; shared-secret header fallback | Security |
| R04 | Under-purging (stale content) | 3 | 4 | 12 | Cache tag discipline, purge dependency graph tests, monitoring | Platform |
| R05 | Over-purging (thundering herd) | 3 | 3 | 9 | Origin shield, rate limiting, batch purges, SWR (serve stale briefly) | Platform |
| R06 | Preview content leakage | 2 | 4 | 8 | Preview-only hostname, token auth, no-store headers, Akamai bypass rule | Security |
| R07 | WAF false positives blocking editors | 3 | 3 | 9 | Alert mode before deny mode, custom exceptions for admin paths | Security |
| R08 | Bot scraping sensitive content | 3 | 3 | 9 | Bot Manager, rate limiting, honeypot traps | Security |
| R09 | Credential stuffing on login | 3 | 4 | 12 | Rate limiting, CAPTCHA, MFA enforcement, anomaly detection | Security |
| R10 | SQL injection | 2 | 5 | 10 | Parameterized queries, TypeORM, WAF rules, code review | Security |
| R11 | Malware upload via asset pipeline | 2 | 4 | 8 | MIME validation, malware scan, sandbox processing | Security |
| R12 | SSRF via external media import | 2 | 4 | 8 | URL allowlist, IP block list, DNS rebinding protection | Security |
| R13 | Secret leakage (git) | 2 | 5 | 10 | detect-secrets pre-commit hook, Vault, no secrets in ENV visible in logs | Security |
| R14 | JWT signing key compromise | 1 | 5 | 5 | RS256 (asymmetric), key rotation, Vault HSM integration | Security |
| R15 | Akamai product entitlement gap | 3 | 3 | 9 | Confirm all SKUs in Phase 0; fallback designs per feature | PM |
| R16 | Terraform drift (edge config out of sync) | 3 | 3 | 9 | Terraform state in S3 + lock; drift detection alerts; no manual changes | Platform |
| R17 | DNS cutover mistake | 2 | 4 | 8 | Low TTL pre-cutover (300s → 60s); tested rollback; blue/green DNS | Platform |
| R18 | Database migration failure | 2 | 4 | 8 | Backward-compatible migrations; blue/green deploy; tested rollback | Platform |
| R19 | Akamai activation timeout | 2 | 3 | 6 | Activation monitoring in CI; auto-rollback on timeout; Akamai support | Platform |
| R20 | Editorial workflow complexity rejection | 3 | 2 | 6 | User research in Phase 0; iterative UX; phased workflow complexity | Product |
| R21 | Media storage cost growth | 3 | 2 | 6 | S3 lifecycle policies (Glacier after 2y); media deduplication; size limits | Ops |
| R22 | Streaming bandwidth cost spike | 2 | 3 | 6 | Token auth prevents unauthorized streams; per-video bandwidth caps; cost alerts | Ops |
| R23 | Video transcoding failure | 2 | 3 | 6 | Retry on failure; dead-letter queue; editor notification; manual re-transcode | Platform |
| R24 | Log pipeline cost (DataStream 2 + OpenSearch) | 3 | 2 | 6 | ILM (90d online, archive after); filter low-value log fields; sampling for high-volume | Ops |
| R25 | Multi-locale content inconsistency | 3 | 2 | 6 | Per-locale status tracking; translation status dashboard; locale-specific cache keys | Editorial |
| R26 | Search index desync | 2 | 3 | 6 | Idempotent indexing; daily full re-index job; search health check | Platform |
| R27 | Scheduled publish missing (worker down) | 2 | 3 | 6 | K8s pod restart policy; alert on missed schedule; dead-letter queue | Platform |
| R28 | DDoS during high-profile event | 2 | 4 | 8 | Akamai DDoS protection; circuit breakers; static error page at edge | Security |
| R29 | Editor accidentally publishes wrong version | 3 | 3 | 9 | Confirmation dialog with diff preview; one-click rollback; audit log | Product |
| R30 | Purge credentials compromise | 1 | 4 | 4 | Least-privilege purge-only credentials; Secrets Manager; rotation | Security |
| R31 | Edge log data loss (DataStream buffer overflow) | 2 | 2 | 4 | Monitor DataStream delivery status; alerting on delivery failures | Platform |
| R32 | Stale EdgeKV redirect data | 2 | 3 | 6 | Atomic update (write new then delete old); version key in EdgeKV; edge cache bypass for redirect check | Platform |

---

## Top Risk Detail Sheets

### R04: Under-Purging (Stale Content)

**Scenario:** Editor publishes article with corrected information. Cache tag dependency graph incomplete — listing page still shows old headline for 5 minutes.

**Detection:** 
- Monitor: compare expected content version with live content via synthetic check
- Grafana: alert if publish job completes but page still returns old Surrogate-Key age > expected TTL

**Mitigation (layered):**
1. Cache tag generation tests (unit + integration) verify all dependent tags emitted
2. Integration test: publish → verify cache miss within 30s for all dependent tags
3. Default: prefer short TTLs (5 min for dynamic content) so staleness is bounded
4. Manual override: emergency purge UI for editors to trigger immediate purge
5. Post-publish cache validation: Reporting worker probes top 10 published URLs post-purge to confirm freshness

**Residual risk:** Low — bounded to TTL duration if purge fails.

---

### R02: Personalized Content Cached Publicly

**Scenario:** User-specific content (e.g., cart count, personalized recommendations) served to all users because session cookie was not excluded from cache.

**Detection:**
- Integration test: authenticated request must return `Cache-Control: private, no-store`
- Akamai rule test: response with session cookie present must not be cached (verify via `X-Check-Cacheable: NO`)

**Mitigation:**
1. Rule hierarchy: authenticated route rule (cookie presence) PRECEDES public cache rule
2. Strip all cookies except allowlisted ones (none for public pages)
3. Akamai staging test: request with session cookie → verify NOT cached
4. Code review: any endpoint serving user-specific data must set `Cache-Control: private, no-store`
5. Monitoring: alert if authenticated endpoint ever returns `X-Check-Cacheable: YES`

---

### R16: Terraform Drift

**Scenario:** Engineer makes emergency Akamai rule change directly in Luna Portal. Terraform state becomes stale. Next apply overwrites the emergency fix.

**Prevention:**
1. Policy: no manual changes to Akamai properties — all changes via Terraform PR
2. Drift detection: daily `terraform plan` in CI; alert on non-empty plan
3. Emergency exception: if manual change required, immediately open PR to codify it
4. State locking: Terraform state in S3 + DynamoDB lock; prevents concurrent applies
5. Audit: Akamai change log auditable via PAPI history

---

## Risk Acceptance Criteria

Risks with score ≤ 4 are accepted with monitoring.  
Risks with score 5-8 require documented mitigation and quarterly review.  
Risks with score ≥ 9 require active mitigation plan before production launch.

Current risks requiring pre-launch mitigation: R01, R02, R03, R04, R05, R07, R09, R10, R13, R15

---

## Open Questions

1. **Akamai contract:** Which of the following are available: AMD, IVM, Bot Manager, EdgeWorkers, EdgeKV, DataStream 2, Site Shield, App & API Protector? (Critical for Phase 2+)

2. **Origin cloud provider:** AWS confirmed, but which regions? (us-east-1 + eu-west-1 assumed)

3. **Video transcoding:** AWS MediaConvert vs. Mux vs. self-hosted FFmpeg? (Cost vs. operational complexity)

4. **Search volume:** Expected search QPS? (Determines OpenSearch cluster sizing)

5. **Peak traffic estimate:** Expected launch day traffic? (Determines autoscaling config and Akamai contract size)

6. **Content migration:** Existing CMS? Volume of content to migrate? (Determines Phase 8 migration effort)

7. **Translation workflow:** Automated machine translation integration needed? Which provider? (Affects Phase 9 scope)

8. **GDPR / data residency:** EU users? Data residency requirements for content and logs? (Affects region strategy)

9. **Ad insertion:** Timeline and revenue expectations for SSAI? (Affects Phase 9 priority)

10. **Multi-tenant vs. multi-site:** Are external clients using this platform (SaaS) or internal only? (Affects pricing and isolation requirements)

11. **Akamai NetStorage:** Available for video/media delivery (co-location with AMD)? Or S3 origin only?

12. **WAF tuning runway:** How long before first production activation to run WAF in alert mode? (Recommend minimum 2 weeks)
