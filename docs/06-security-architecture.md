# Security Architecture

## Security Layering Model

```
Layer 1: Network / DDoS          → Akamai Prolexic / built-in DDoS
Layer 2: WAF                     → Akamai App & API Protector
Layer 3: Bot Management          → Akamai Bot Manager [ENTITLEMENT]
Layer 4: Rate Limiting           → Akamai Edge + CMS API (Redis)
Layer 5: Authentication          → JWT/OIDC at API layer
Layer 6: Authorization           → RBAC + row-level site isolation
Layer 7: Input Validation        → API validation layer (class-validator)
Layer 8: Upload Security         → MIME check + malware scan + size limits
Layer 9: Output Security         → CSP, HSTS, X-Frame-Options, etc.
Layer 10: Secret Management      → Vault / AWS Secrets Manager
Layer 11: Audit & Monitoring     → Audit logs + SIEM alerts
```

---

## TLS / Certificate Management

```
Certificates:
  - All hostnames managed via Akamai CPS (Certificate Provisioning System)
  - Certificate type: DV (auto-renewed via Let's Encrypt or DigiCert via Akamai)
  - Wildcard: *.example.com for all subdomains
  - SAN (Subject Alternative Name): www.example.com, api.example.com, cdn.example.com, streams.example.com
  
TLS Policy:
  - Minimum: TLS 1.2 (TLS 1.0/1.1 disabled)
  - Preferred: TLS 1.3
  - Cipher suites: AES-256-GCM, CHACHA20-POLY1305 (modern only)
  - OCSP stapling: enabled
  - Certificate transparency: enabled
  
Origin TLS:
  - Origin (load balancer) must present valid TLS certificate
  - Akamai validates SNI + hostname match for origin connections
  - Internal CA or public cert for origin (not self-signed without custom validation)
  
HSTS:
  - Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  - Submit to HSTS preload list after initial rollout
  - Injected by Akamai response header rule (guarantees it's always present)
```

---

## WAF Design (Akamai App & API Protector)

### Policy Structure

```
Policy: cms-waf-production
  Mode: DENY (block mode — start in alert mode, move to deny after tuning)
  Rule set: KRS (Kona Rule Set) — automatic signature updates
  
  Custom rules:
    Rule ID: CUSTOM-001 — Block non-Akamai origin access
      Match: Request not from Akamai IPs AND path not /health
      Action: DENY (this is backup; primary protection is firewall)
    
    Rule ID: CUSTOM-002 — Admin path protection
      Match: Path begins with /api/v1/admin/ AND not from approved IP ranges
      Action: DENY
    
    Rule ID: CUSTOM-003 — Upload endpoint rate limit
      Match: Path = /api/v1/admin/assets/upload-url AND rate > 20/min/IP
      Action: SLOW_DOWN (rate limit)
    
    Rule ID: CUSTOM-004 — Login endpoint protection
      Match: Path = /api/v1/auth/login AND rate > 5/min/IP
      Action: SLOW_DOWN then DENY

  Exceptions (tuned after initial rollout):
    - Skip rule X for path /api/v1/content/{type} (if false positive on JSON body)
    - Allow URL-encoded content in rich text fields (controlled exception)
    
  API Definition (App & API Protector):
    Define OpenAPI spec for /api/v1/content/* 
    Enforces: method, path, parameter types, body structure
    
Alert thresholds:
  - WAF blocks > 100/min → PagerDuty alert
  - WAF blocks spike (3x baseline) → PagerDuty alert
```

---

## Bot Management `[ENTITLEMENT: Akamai Bot Manager]`

```
Endpoints with bot protection:
  /api/v1/auth/login           → CAPTCHA challenge for suspicious bots
  /api/v1/auth/register        → CAPTCHA challenge
  /search                      → Rate limit aggressive scrapers
  /sitemap.xml                 → Allow legitimate crawlers; rate limit others
  
Bot categories:
  KNOWN_GOOD: Googlebot, Bingbot, etc. → allow, no challenge
  KNOWN_BAD: malicious scrapers → deny
  UNKNOWN: behavioral analysis → score-based challenge
  
Fallback (without Bot Manager entitlement):
  - Rate limiting via Akamai Edge Rate Control [ENTITLEMENT: Rate Control Cloudlet]
  - OR: rate limiting in CMS API (Redis-based, IP + endpoint key)
    // Redis rate limit key: ratelimit:ip:login:{ip}
    // Max: 5 requests per 60s
    // On exceed: return 429 Too Many Requests, Retry-After: 60
```

---

## Origin Protection (Site Shield)

### Firewall Rules `[ENTITLEMENT: Akamai Site Shield]`

```
Site Shield provides a static list of Akamai forward proxy IPs.
Origin firewall (security group / iptables) rule:

ALLOW  TCP/443  from AKAMAI_SITE_SHIELD_CIDR_LIST
ALLOW  TCP/443  from ADMIN_TEAM_VPN_CIDR
ALLOW  TCP/443  from CI_CD_RUNNER_IP (for health checks, smoke tests)
DENY   TCP/443  from 0.0.0.0/0

Site Shield IP list updates:
  - Akamai provides list via Luna Portal / API
  - Automated refresh: script polls Akamai IP list API weekly
  - Update firewall rules automatically (Terraform or cloud-native security groups)
  - Alert if list update fails (firewall rules must stay current)

Alternative (without Site Shield entitlement):
  - Shared Secret header: Origin verifies X-Origin-Secret header matches secret value
    Origin denies requests without header
  - Secret stored in Vault; rotated quarterly
  - Less robust than Site Shield (secret could leak) but practical fallback
  - Implement BOTH if possible (defense in depth)
```

---

## Authentication & Authorization

### CMS Admin Auth Flow

```
1. Editor navigates to admin.example.com
2. Akamai edge: IP allowlist check (admin zone rule)
   - If IP not in allowlist: 403 Forbidden
3. Next.js admin console: redirect to OIDC provider (Okta/Google/Azure AD)
4. OIDC provider: user authenticates + MFA
5. OIDC provider: redirect back with authorization code
6. Next.js: exchange code for tokens (server-side, never client-side)
7. CMS API: validate ID token, look up user record, issue CMS JWT
   JWT payload: {sub, user_id, email, sites: [{id, role}], iat, exp}
   JWT signed with RS256 private key (keys rotated quarterly)
8. JWT stored in httpOnly, Secure, SameSite=Strict cookie
9. All admin API calls include cookie (CSRF protection via SameSite)
10. Session duration: 8 hours active, refresh token for 7 days

MFA requirement: enforced at OIDC provider level (not optional)
```

### API Key Authentication (Delivery API)

```
Public CMS API (for frontend consumers):
  - API keys issued per integration (site + usage type)
  - Format: Bearer <base64-encoded-opaque-token>
  - Stored in CMS DB as bcrypt hash
  - Rate limited per key: 1000 req/min default (configurable)
  - Key scope: read-only (cannot access admin endpoints)
  - Keys can be revoked (status = inactive in DB)
  
Akamai does NOT enforce API key validation (that's at origin).
Akamai does enforce rate limits by IP for abuse protection.
```

### JWT Configuration

```javascript
// NestJS JWT strategy
const jwtOptions = {
  secret: process.env.JWT_PRIVATE_KEY,       // RS256 private key from Vault
  publicKey: process.env.JWT_PUBLIC_KEY,     // For verification
  signOptions: {
    algorithm: 'RS256',
    expiresIn: '8h',
    issuer: 'cms.example.com',
    audience: 'cms-admin'
  }
};

// Preview JWT (separate)
const previewJwtOptions = {
  secret: process.env.PREVIEW_JWT_SECRET,   // HS256 for simplicity
  signOptions: {
    algorithm: 'HS256',
    expiresIn: '1h'
  }
};
```

---

## Content Security Policy

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{RANDOM_NONCE}';
  style-src 'self' 'nonce-{RANDOM_NONCE}' https://fonts.googleapis.com;
  img-src 'self' https://cdn.example.com data: blob:;
  media-src 'self' https://streams.example.com;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
  block-all-mixed-content;

Notes:
  - Nonce generated per request (cannot use 'unsafe-inline')
  - Next.js nonce integration: generateNonce in middleware
  - CSP injected by Akamai response header behavior (backup) AND by origin (primary)
  - Admin console has relaxed CSP for Tiptap editor: script-src 'self' 'unsafe-eval' (regrettable but required by some editor libs)
  - Report-only mode first; switch to enforce after baseline established
  - CSP violations reported to: /api/v1/csp-report (logged, alerted on spikes)
```

---

## Upload Security

```
Upload validation pipeline (executed after S3 upload, before asset confirmation):

1. MIME type validation:
   - Re-detect MIME type using file magic bytes (not client Content-Type)
   - Allowed types defined per site config (image/*, video/*, application/pdf, etc.)
   - REJECT: application/x-executable, application/x-sh, text/html, etc.

2. File size limits:
   - Images: 50MB max
   - Documents: 100MB max
   - Videos: 10GB max (async processing)
   - Configurable per site and per content type

3. Malware scanning:
   - Option A: ClamAV sidecar container in upload processing pod
     POST /scan → virus scan → clean/infected result
   - Option B: Cloud service (AWS GuardDuty Malware Protection, or VirusTotal API)
   - On infected: QUARANTINE → do not make public → alert security team → delete after review
   - On scan failure: block upload with 503, retry later (do not allow unscanned content)

4. Image processing security:
   - Use libvips (sharp) for image processing — not ImageMagick (known vulnerabilities)
   - Sharp processes images in a sandboxed worker
   - Validate dimensions (reject > 50000x50000 pixels — billion pixel attack)
   - Strip EXIF metadata before storing (privacy + GPS data)

5. SVG sanitization:
   - SVGs are code (can contain JavaScript)
   - Run DOMPurify on SVG content before storing
   - OR: serve SVGs with Content-Type: image/svg+xml only from dedicated domain (cdn.example.com) not same origin
   - Never inline SVGs from user uploads into HTML without sanitization

6. SSRF protection for external media imports:
   - URL allowlist: only allow importing from pre-approved domains
   - Block: localhost, 169.254.x.x (metadata service), 10.x.x.x, 172.16-31.x.x, 192.168.x.x
   - Resolve URL to IP before fetch; check IP against block list (DNS rebinding protection)
   - Timeout: 30s max for external fetch
   - Max file size: 100MB for imported media
```

---

## Signed URLs / Token Auth for Protected Video

```
Token generation (CMS API or dedicated token service):

Algorithm: Akamai EdgeAuth Token (HMAC-SHA256)

Token fields:
  hdntl = expiry timestamp (unix epoch)
  ip = client IP (optional — bind token to IP for higher security)
  acl = URL path pattern (e.g., /streams/video-id/*)
  data = {user_id, entitlement_id} (optional metadata)
  
Signing:
  hmac = HMAC-SHA256(key, "exp=<hdntl>~acl=<acl>")
  token = "exp=<hdntl>~acl=<acl>~hmac=<hmac>"
  
URL: https://streams.example.com/streams/{video_id}/master.m3u8?hdntl={token}

EdgeWorker validates:
  1. Token present (if required for this stream)
  2. HMAC valid (token not tampered)
  3. Not expired (hdntl > now)
  4. IP matches (if IP binding enabled)
  5. ACL path matches request path

Token issuance flow:
  1. Frontend calls CMS API: POST /api/v1/video/{id}/token
  2. CMS API checks entitlement (subscription, purchase, etc.)
  3. CMS API generates token (short-lived: 4 hours)
  4. CMS API returns token to frontend
  5. Frontend appends token to HLS/DASH URL
  6. Player requests stream with token
  
Geo restriction (independent of token):
  EdgeWorker reads geo_restriction from EdgeKV for video_id:
  If client country in deny list: 403 Forbidden
  If client country not in allow list (if allow mode): 403 Forbidden
```

---

## Secret Management

```
Secret categories and storage:

Category               | Store                           | Rotation
-----------------------|----------------------------------|----------
Database passwords     | AWS Secrets Manager / Vault     | Quarterly
Redis password         | AWS Secrets Manager / Vault     | Quarterly
JWT signing keys       | Vault (key/value + transit)     | Quarterly
Preview JWT secret     | AWS Secrets Manager             | Quarterly
Akamai purge API creds | AWS Secrets Manager             | Annually (Akamai tokens)
Akamai property creds  | AWS Secrets Manager / .edgerc  | Annually
S3 access keys         | IAM roles (no static keys)      | N/A (role-based)
Webhook secrets        | DB (encrypted column)           | On-demand
OAuth client secrets   | AWS Secrets Manager             | Annually
Video token keys       | AWS Secrets Manager             | Quarterly
Site Shield secret     | AWS Secrets Manager             | Quarterly
Malware scan API key   | AWS Secrets Manager             | Annually

Rules:
  - NO secrets in git repositories (pre-commit hook: detect-secrets)
  - NO secrets in environment variables visible in logs
  - Applications fetch secrets at startup from Vault/Secrets Manager
  - Kubernetes: External Secrets Operator or Vault Agent Injector
  - Rotation: automated where possible; alerts for manual rotation due
```

---

## Staging-Only Security Testing (DAST)

```
POLICY: Security testing ONLY on owned staging environments. NEVER on production.
POLICY: NEVER test third-party systems, even indirectly.
POLICY: Rate-limit all security scanning tools (max 10 req/s against staging).

OWASP ZAP Configuration:
  Target: https://staging.example.com
  Authorization: Operator must approve test run via Jira ticket + Slack notification
  
  ZAP scan profile:
    Active Scan: enabled (full OWASP Top 10 coverage)
    Spider: enabled (max depth: 5, max children: 100)
    Passive Scan: enabled on all responses
    
  Rate limits:
    Max concurrent requests: 5
    Delay between requests: 100ms minimum
    Max duration: 4 hours (auto-stop)
    
  Excluded paths:
    - /api/v1/admin/purge (avoid triggering mass purges)
    - /api/v1/auth/logout (avoid session invalidation loop)
    - /api/v1/webhooks/* (avoid triggering outbound webhooks)
    - External domains: NEVER
    
  Alert thresholds:
    CRITICAL: Any injection finding → immediate Jira + Slack alert
    HIGH: Any auth bypass → immediate alert
    MEDIUM: Log to security backlog, review weekly
    
  CI/CD integration:
    - ZAP runs in Docker as part of security-test stage
    - Fails pipeline on CRITICAL or HIGH findings
    - Report archived as artifact
    - Full ZAP report reviewed by security lead monthly
    
  Schedule:
    - On-demand: triggered by developer before major release
    - Automated: weekly (Saturday 2am) on staging
```

---

## Security Incident Response Workflow

```
Severity levels:
  P0 - Critical: Active breach, data exposure, service down
  P1 - High: WAF bypass, auth vulnerability, DDoS underway  
  P2 - Medium: Elevated bot activity, WAF spike, suspicious scan
  P3 - Low: Single failed login, minor anomaly

Response steps (P0/P1):

1. DETECT (automated):
   - Akamai WAF blocks spike alert → PagerDuty
   - Anomalous origin traffic alert → PagerDuty
   - Authentication failure rate spike → Slack + PagerDuty
   
2. CONTAIN (within 15 min):
   - Enable WAF deny-all emergency mode (Akamai console or API)
   - Block attacking IP range via Akamai Network List
   - If data exposure: disable affected endpoint (Akamai return 503 rule)
   - Revoke compromised API keys / JWT secret (forces all re-auth)
   
3. ANALYZE (within 1 hour):
   - Pull DataStream 2 logs for affected time window
   - Correlate with application logs in OpenSearch
   - Identify attack vector and scope
   - Check audit logs for unauthorized content/config changes
   
4. RECOVER:
   - Remove emergency blocks (targeted, not broad)
   - Deploy patches
   - Re-activate normal WAF rules
   - Verify all purges completed if cache was poisoned
   
5. POST-INCIDENT:
   - Write incident report (timeline, root cause, impact)
   - Update WAF rules to prevent recurrence
   - Update runbook
   - GDPR notification if PII involved (72-hour regulatory deadline)

Emergency contacts:
  Akamai Support: Luna Portal → Support ticket (P1 = phone call to TAM)
  Internal: security@ team, platform oncall
```
