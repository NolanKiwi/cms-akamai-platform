# Repository Structure and Runbooks

## Production Readiness Checklist

```
Infrastructure
  [ ] All Terraform modules reviewed and applied to production
  [ ] Akamai properties activated to PRODUCTION network
  [ ] CP codes provisioned and assigned to correct rule trees
  [ ] Site Shield IP allowlist active on origin firewall
  [ ] S3 bucket policies: public access blocked, versioning enabled
  [ ] PostgreSQL: multi-AZ enabled, automated backups configured
  [ ] Redis: cluster mode enabled, persistence configured
  [ ] Kubernetes: pod disruption budgets set, HPA configured
  [ ] Secrets: all secrets in Vault/Secrets Manager, none in env or git

Security
  [ ] WAF in DENY mode (not alert)
  [ ] Bot Manager active on login and search endpoints
  [ ] Admin paths returning 403 from edge
  [ ] HTTPS enforced (HTTP → HTTPS redirect active)
  [ ] HSTS header present with preload
  [ ] CSP in enforce mode (not report-only)
  [ ] JWT key rotation date set in calendar
  [ ] MFA enforcement verified at OIDC provider
  [ ] Penetration test sign-off obtained
  [ ] OWASP ZAP zero HIGH/CRITICAL

Akamai
  [ ] All properties on latest rule format
  [ ] DataStream 2 active for all production CP codes
  [ ] Fast Purge credentials least-privilege (purge only)
  [ ] Staging activation validated before each production activation
  [ ] EdgeWorkers deployed and tested in staging
  [ ] Compression (brotli) confirmed on text responses
  [ ] HTTP/3 enabled if contracted

Observability
  [ ] Prometheus: all alerting rules active
  [ ] PagerDuty: escalation policy tested
  [ ] Grafana dashboards: all 4 dashboards rendering
  [ ] DataStream logs flowing to OpenSearch (< 5 min latency)
  [ ] Synthetic monitoring: 5-region probes active
  [ ] Error budget tracking enabled

CI/CD
  [ ] Branch protection: main and develop require PR + CI pass
  [ ] Staging deploy automated on merge to develop
  [ ] Production deploy requires manual approval
  [ ] Akamai staging validation step in pipeline
  [ ] Rollback procedure documented and tested

Operational
  [ ] On-call rotation scheduled (PagerDuty)
  [ ] All runbooks written and reviewed
  [ ] Incident response runbook tested (tabletop exercise)
  [ ] Disaster recovery test completed
  [ ] Backup restore tested
  [ ] Capacity estimate for peak traffic documented

Editorial
  [ ] CMS admin console smoke test passed
  [ ] Publishing workflow tested end-to-end
  [ ] Preview environment working
  [ ] Scheduled publish tested
  [ ] Rollback tested
  [ ] Media upload tested
  [ ] Purge UI tested by operators

Legal / Compliance
  [ ] Privacy policy reflects data flows (log IP addresses, etc.)
  [ ] GDPR data subject request process documented
  [ ] Cookie banner implemented if needed
  [ ] Accessibility audit passed (WCAG 2.1 AA)
  [ ] Legal sign-off on external content policies
```

---

## Operational Runbooks

### Runbook 1: Emergency Cache Purge

**When to use:** Content error, security issue, incorrect data live in production.

```
1. Identify scope:
   - Single URL → URL purge
   - Content type / category → tag purge
   - Site-wide → CP code purge (nuclear)

2. Access emergency purge UI:
   admin.example.com → Operations → Emergency Purge

3. For single URL purge:
   a. Enter URL(s) in URL field
   b. Add reason: "Emergency: [description]"
   c. Click "Preview Impact" — confirm expected scope
   d. Click "Submit Purge" and type CONFIRM
   e. Monitor status (auto-refresh, target < 10s completion)

4. For CP code purge (nuclear):
   a. Requires second approver (Slack DM to senior engineer)
   b. Both engineers click "Approve" in UI
   c. System executes after dual approval
   d. Monitor origin load — expect spike (thundering herd)
   e. Origin should handle: SWR + origin shield reduces thundering herd

5. Verify:
   a. Open published URL in incognito, hard refresh
   b. Confirm correct content displayed
   c. Check Response headers: Age should be 0 (fresh)

6. Document:
   Purge auto-logged to purge_log table and Slack #operations-alerts
```

### Runbook 2: Origin Failure Response

```
Signs: Grafana origin error rate spike > 5%, PagerDuty alert

1. Check origin status:
   kubectl get pods -n cms-production
   kubectl logs -n cms-production -l app=cms-api --tail=100

2. Check database:
   kubectl exec -it -n cms-production deploy/cms-api -- node -e "
     const {Pool} = require('pg');
     new Pool({connectionString: process.env.DATABASE_URL})
       .query('SELECT 1')
       .then(() => console.log('DB OK'))
       .catch(e => console.error('DB ERROR:', e.message));
   "

3. If pods crash-looping:
   kubectl rollout history deployment/cms-api -n cms-production
   kubectl rollout undo deployment/cms-api -n cms-production  # rollback
   kubectl rollout status deployment/cms-api -n cms-production

4. If DB unreachable:
   - Check RDS status in AWS Console
   - If primary failed: failover to replica (RDS Multi-AZ auto-fails)
   - Update DATABASE_URL in Kubernetes secret to replica endpoint (if manual)
   
5. Verify Akamai SWR is serving stale:
   - Edge should be serving cached content during origin outage (SWR: up to 1h)
   - Check DataStream for origin_hits drop + edge_hits stay high
   
6. After recovery:
   - Purge any pages that may have been stale during outage
   - Review error logs for root cause
   - Write incident report
```

### Runbook 3: Akamai Property Rollback

```
When to use: Production activation causes issues (wrong behavior, errors spike)

1. Check current version:
   Luna Portal → Properties → cms-production-www → Versions

2. Identify last-known-good version number (N-1)

3. Via Terraform (preferred):
   cd infra/terraform/environments/production
   terraform apply -var="property_version=<N-1>"

4. Via Luna Portal (faster for emergency):
   Properties → cms-production-www → Versions → select N-1
   Actions → Activate to Production → Submit
   Wait for activation (5-15 min)

5. Monitor DataStream for error rate recovery

6. File post-mortem and update Terraform to match rolled-back state
```

### Runbook 4: Database Backup Restore

```
Scenario: Accidental data deletion or corruption

1. Stop write traffic to affected DB (or enable maintenance mode):
   kubectl scale deployment/cms-api --replicas=0 -n cms-production
   kubectl scale deployment/publisher-worker --replicas=0 -n cms-production

2. Identify recovery point:
   AWS Console → RDS → Automated Backups → cms-postgres-production
   OR: WAL-G: list-backups → choose point-in-time

3. Restore to new RDS instance:
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier cms-postgres-production \
     --target-db-instance-identifier cms-postgres-restore \
     --restore-time 2026-04-27T09:00:00Z

4. Verify data in restored instance

5. Update DATABASE_URL in Kubernetes secrets to restored instance

6. Scale application back up
   kubectl scale deployment/cms-api --replicas=3 -n cms-production

7. Purge cache (content may have changed)
   Trigger emergency CP code purge

8. Promote restored instance as new primary (if original corrupted):
   Rename / swap DNS
```

### Runbook 5: Secret Rotation

```
JWT Signing Key Rotation:

1. Generate new RS256 key pair:
   openssl genrsa -out private.pem 4096
   openssl rsa -in private.pem -pubout -out public.pem

2. Store new keys in Vault:
   vault kv put secret/cms/production/jwt \
     private_key=@private.pem \
     public_key=@public.pem \
     previous_public_key=$(vault kv get -field=public_key secret/cms/production/jwt)

3. Deploy application (reads new keys at startup):
   kubectl rollout restart deployment/cms-api -n cms-production

4. Transition window (15 min):
   - New key signs new tokens
   - Old key validation supported (previous_public_key still accepted)
   - After 15 min: all active sessions have refreshed

5. Remove old key from Vault:
   vault kv patch secret/cms/production/jwt previous_public_key=""

6. Monitor: no auth errors after rotation

Akamai Purge Credential Rotation:
1. Generate new client credentials in Akamai Luna → Identity Management
2. Store in AWS Secrets Manager
3. Update purge-worker Kubernetes secret:
   kubectl create secret generic akamai-purge-creds \
     --from-literal=host=... \
     --from-literal=client_token=... \
     --from-literal=client_secret=... \
     --from-literal=access_token=... \
     --dry-run=client -o yaml | kubectl apply -f -
4. Rollout restart purge-worker
5. Revoke old credentials in Luna Portal
```

---

## Architecture Decision Records (ADR Index)

```
docs/architecture/
├── ADR-001-nextjs-for-frontend.md        NestJS for CMS API (not Go/Java)
├── ADR-002-nestjs-for-cms-api.md         NestJS over Express for module system
├── ADR-003-bullmq-over-kafka.md          BullMQ for MVP; upgrade path to Kafka documented
├── ADR-004-opensearch-for-search-logs.md Single OpenSearch for search + logs (vs separate)
├── ADR-005-tag-purge-over-url-purge.md   Tag purge as default; URL purge as fallback
├── ADR-006-invalidate-over-delete.md     Invalidate preferred over delete for CDN purge
├── ADR-007-s3-over-netstorage.md         S3 for media; NetStorage considered for streaming
├── ADR-008-postgres-over-mysql.md        PostgreSQL for JSONB and advanced indexing
├── ADR-009-redis-for-queue.md            BullMQ/Redis for queue instead of RabbitMQ
├── ADR-010-monorepo-turborepo.md         Monorepo with Turborepo for build caching
└── ADR-011-github-actions-for-cicd.md    GitHub Actions chosen over Jenkins/GitLab CI
```
