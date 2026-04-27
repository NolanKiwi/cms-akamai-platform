# Akamai CDN Design

> **Note:** Akamai product names, API endpoints, and entitlements are subject to account-specific contracts. Always validate feature availability with your Akamai account team. Features marked `[ENTITLEMENT]` require specific product add-ons.

---

## Property Structure

### Property Strategy: One Property per Environment per Function

```
cms-production-www          # Main delivery: HTML, API, static
cms-production-media        # Images, downloads, documents
cms-production-streams      # VOD / live streaming (AMD)
cms-staging-www             # Staging mirror of production
cms-staging-media           # Staging media
cms-admin-internal          # Admin console (internal delivery, heavily restricted)
```

**Why separate properties:**
- Separate activation timelines (media rules change less than HTML rules)
- Separate CP codes per property for billing clarity
- Separate security policies without cross-contamination
- Separate DataStream configurations per traffic class

---

## Hostname Strategy

| Hostname | Property | Purpose |
|---|---|---|
| `www.example.com` | cms-production-www | Primary public website |
| `cdn.example.com` | cms-production-media | Media/asset delivery |
| `streams.example.com` | cms-production-streams | Video streaming |
| `admin.example.com` | cms-admin-internal | CMS admin console |
| `api.example.com` | cms-production-www | Public CMS API |
| `staging.example.com` | cms-staging-www | Staging environment |
| `preview.example.com` | cms-staging-www | Preview environment (token gated) |

---

## Edge Hostname Strategy

```
www.example.com.edgesuite.net        → www.example.com
cdn.example.com.edgesuite.net        → cdn.example.com
streams.example.com.akamaized.net    → streams.example.com (AMD optimized)
```

- Standard properties use `*.edgesuite.net`
- Streaming properties use `*.akamaized.net` (AMD-optimized network)
- HTTPS only; HTTP redirected to HTTPS via Akamai redirect rule
- HTTP/2 enabled by default; HTTP/3 (QUIC) enabled `[ENTITLEMENT: requires Ion Premier or Ion Enhanced]`

---

## CP Code Segmentation

| CP Code | Name | Purpose | Property |
|---|---|---|---|
| CP-001 | WEB-STATIC-PROD | Hashed static assets (JS/CSS/fonts) | cms-production-www |
| CP-002 | WEB-DYNAMIC-PROD | HTML pages and SSR responses | cms-production-www |
| CP-003 | WEB-API-PROD | Public REST/GraphQL API responses | cms-production-www |
| CP-004 | MEDIA-IMAGES-PROD | Image delivery and IVM derivatives | cms-production-media |
| CP-005 | MEDIA-DOCS-PROD | Documents and downloadable files | cms-production-media |
| CP-006 | STREAMS-VOD-PROD | VOD HLS/DASH delivery | cms-production-streams |
| CP-007 | STREAMS-LIVE-PROD | Live streaming delivery | cms-production-streams |
| CP-008 | WEB-STATIC-STG | Static assets staging | cms-staging-www |
| CP-009 | WEB-DYNAMIC-STG | HTML/API staging | cms-staging-www |
| CP-010 | MEDIA-IMAGES-STG | Images staging | cms-staging-media |

**CP code usage:** Assigned per rule via `Assign CP Code` behavior. Enables per-traffic-type billing reports and DataStream filtering.

---

## Rule Hierarchy (cms-production-www)

```
Default Rule
├── [Behavior] Forward to origin (LB endpoint)
├── [Behavior] Origin Shield: enabled (SureRoute)
├── [Behavior] HTTP/2: enabled
├── [Behavior] Compress: gzip + brotli
├── [Behavior] HSTS: max-age=31536000; includeSubDomains; preload
├── [Behavior] Security headers injection
│
├── Rule: HTTPS Redirect
│   Match: Scheme = HTTP
│   Behavior: Redirect → https://{host}{path} (301)
│
├── Rule: Health Check Bypass
│   Match: Path = /health OR /ready
│   Behavior: No cache, bypass WAF, forward to origin
│
├── Rule: Admin API Block at Edge
│   Match: Path begins with /api/v1/admin
│   Behavior: Deny (403) — admin traffic must use internal network
│
├── Rule: Static Assets (Immutable Hashed)
│   Match: Path begins with /_next/static/ OR /static/
│   Behavior:
│     - CP Code: CP-001
│     - Cache: max-age=31536000 (override origin)
│     - Cacheability: cacheable
│     - Strip all cookies
│     - Strip most headers except Accept-Encoding
│     - Compress: brotli preferred
│     - SureRoute: enabled
│
├── Rule: Static Files (Unhashed)
│   Match: Extension = .ico, .txt, .xml, .json (non-API)
│   Behavior:
│     - CP Code: CP-001
│     - Cache: max-age=3600
│     - Strip cookies
│
├── Rule: Image Delivery (delegated to cms-production-media via redirect or separate property)
│   Match: Path begins with /images/ OR /uploads/
│   Behavior:
│     - Forward to cms-production-media property (CNAME to cdn.example.com)
│     - OR serve directly with IVM policy if on same property
│
├── Rule: API Responses (Public Read)
│   Match: Path begins with /api/v1/content/ OR /api/v1/search/
│   Behavior:
│     - CP Code: CP-003
│     - Cache: use Surrogate-Control header from origin
│     - Strip: all cookies
│     - Normalize query string: allowlist [page, size, sort, locale, filter]
│     - No compression of JSON (already small; let origin decide)
│     - Add CORS headers if needed
│
├── Rule: Dynamic HTML — Authenticated
│   Match: Cookie matches /session=[^;]+/ (session cookie present)
│   Behavior:
│     - No cache (bypass cache lookup)
│     - Forward session cookie
│     - CP Code: CP-002 (tracked separately for auth traffic)
│
├── Rule: Dynamic HTML — Preview
│   Match: Header X-Preview-Token present OR path begins with /preview/
│   Behavior:
│     - No cache
│     - No bot check
│     - Forward to origin
│
├── Rule: Dynamic HTML — Public
│   Match: Default (all remaining HTML requests)
│   Behavior:
│     - CP Code: CP-002
│     - Cache: use Surrogate-Control from origin (default 300s)
│     - Strip cookies (all cookies removed before cache key)
│     - Normalize: device type bucket (desktop/mobile/tablet) added to cache key
│     - Normalize: Accept-Language → locale bucket added to cache key
│     - On origin error (5xx): serve stale if available (SWR up to 3600s)
│     - SureRoute: enabled
│
└── Rule: Error Handling
    Match: Origin response 5xx
    Behavior:
      - Serve stale if less than 1h old (Stale-While-Revalidate)
      - If no stale: serve /errors/500.html from edge (pre-warmed)
      - Alert via DataStream spike detection
```

---

## Cache Behaviors — Detailed

### Surrogate-Control vs Cache-Control

Akamai reads `Surrogate-Control` header (or `Edge-Control`) for edge TTL decisions and **strips** it before forwarding to browser. The browser receives only `Cache-Control`.

**Origin must emit both:**
```http
Surrogate-Control: max-age=300
Cache-Control: public, no-cache, must-revalidate
Surrogate-Key: article:42 listing:articles page:my-slug
```

The `Surrogate-Key` header is stored by Akamai and enables tag-based purge. It is stripped before reaching the browser.

### Cookie Stripping Rules

```
Strip ALL cookies for:
  - Static assets (all)
  - Public HTML pages (public route)
  - Public API responses

Allowlist cookies for:
  - Authenticated routes: session=<token>
  - A/B test bucket: ab_bucket=<x> (add to cache key variation if present)
  - Geo preference: geo_override=<country> (add to cache key if present)

Never forward to cache key (but forward to origin):
  - Analytics cookies (_ga, _fbp, etc.)
  - Ad cookies
```

### Header Normalization

```
Remove from origin request (reduce key complexity):
  - Accept (except for image routes where IVM uses it)
  - User-Agent (replaced by Akamai device group header X-Akamai-Device-Type)
  - Referer (not part of cache key)
  - Cookie (stripped per rules above)

Add to origin request (enrichment):
  - X-Akamai-Device-Type: desktop|mobile|tablet
  - X-Akamai-Country: ISO country code
  - X-Akamai-City: City name
  - X-Forwarded-For: real client IP
  - X-Akamai-Edgescape: full geo data (if enabled)
  - True-Client-IP: real IP for logging

Inject into response (security headers):
  - Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: camera=(), microphone=(), geolocation=()
  - Content-Security-Policy: (complex; see security section)
```

---

## Origin Behaviors

### Origin Shield (SureRoute)

```
Enable SureRoute on all forward origins.
Shield PoP selection: Automatic (Akamai selects optimal shield PoP per region)
  OR Manual: specify shield PoP code for consistent origin routing

SureRoute reduces origin load significantly:
  - Cache HIT at shield: no origin request
  - Cache HIT at edge (from shield fill): single origin request serves many edges
  - Critical for origin protection during traffic spikes
```

### Origin Configuration

```
Forward Protocol: HTTPS (TLS 1.2 minimum)
Origin Hostname: origin.internal.example.com (not public DNS)
Origin Port: 443
Host Header: Forward as: www.example.com (match virtual host at origin)
Cache Key Hostname: www.example.com
Verification: SNI + certificate hostname validation
Custom SNI: origin.internal.example.com → www.example.com
```

### Stale-While-Revalidate (Graceful Degradation)

```
If origin returns 5xx:
  1. Serve stale cached object if age < 3600s
  2. Log stale serve event (DataStream + metric)
  3. Alert if origin error rate > 5% for 2 minutes
  4. If no stale and persistent error: serve static error page from edge
  5. After origin recovers: next request re-fetches fresh content
```

---

## Compression Configuration

```
Enable: Gzip + Brotli
  - Brotli: preferred (better compression ratio)
  - Gzip: fallback for older clients
  - Auto-negotiate via Accept-Encoding

Compress these MIME types:
  text/html, text/css, application/javascript, application/json,
  image/svg+xml, text/xml, application/xml, text/plain,
  application/manifest+json, application/rss+xml

Do NOT compress:
  image/jpeg, image/png, image/webp, image/avif (already compressed)
  video/mp4, video/webm, application/octet-stream
  .gz, .br files (pre-compressed)

Pre-compression at origin:
  Build pipeline emits .br and .gz files alongside originals
  Akamai serves pre-compressed file directly (Content-Encoding: br)
  If pre-compressed not available: Akamai on-the-fly compression
```

---

## HTTP/3 (QUIC) Configuration `[ENTITLEMENT]`

```
HTTP/3 enabled at edge for:
  - www.example.com
  - cdn.example.com

Benefits: reduced connection overhead, 0-RTT reconnect, head-of-line blocking elimination
Fallback: HTTP/2 automatic for clients that don't support QUIC

Origin connection: HTTP/2 or HTTP/1.1 (HTTP/3 to origin not required)
```

---

## Image and Video Manager (IVM) Configuration

### Image Policies

```
Policy: responsive-web
  - Max width: 3840px
  - Quality: 80% default (overridable via ?q= parameter)
  - Format negotiation:
      Accept: image/avif → serve AVIF [ENTITLEMENT: AVIF requires IVM premium]
      Accept: image/webp → serve WebP
      Otherwise: serve original format (JPEG/PNG)
  - Auto-orientation: true (respect EXIF Orientation)
  - Strip metadata: true (reduce file size, privacy)
  - Focal point: if focal_point_x/y set in CMS, crop respects focal point

Policy: thumbnail
  - Fixed dimensions: 400x300 (crop, center or focal point)
  - Quality: 75%
  - Format: WebP preferred

Policy: og-image
  - Fixed: 1200x630
  - Format: JPEG (broad compatibility)
  - Quality: 85%

Parameters allowed via query string:
  ?w=<width>          resize to width (maintain aspect ratio)
  ?h=<height>         resize to height
  ?w=X&h=Y            resize and crop to exact dimensions
  ?q=<1-100>          quality override
  ?f=<format>         format override: webp, avif, jpeg, png
  ?fit=cover|contain  crop behavior

Cache key impact:
  Original path + w + h + q + f + fit + Accept (bucketed: avif|webp|other)
  Note: many unique parameter combos can fragment cache; recommend limiting allowed values
```

### Video Manager `[ENTITLEMENT]`

```
Thumbnail extraction: frame at 10% duration or specified timestamp
  GET /videos/{id}/thumbnail.jpg?t=30  → frame at 30s
  
Thumbnail cache: 30 days at edge, CP Code: MEDIA-IMAGES-PROD
```

---

## Security Policy Attachment

```
Property: cms-production-www
  Attached policy: cms-waf-production
  Mode: KRS (KRS rule set, automatic updates) + custom rules
  
Property: cms-production-media
  Attached policy: cms-waf-media
  Mode: KRS + restrictive for image endpoints
  
Property: cms-production-streams
  Attached policy: cms-waf-streams
  Mode: KRS + token validation bypass for valid tokens
```

See `06-security-architecture.md` for WAF policy details.

---

## DataStream 2 (Logging) Configuration

```
Stream configuration:
  Name: cms-production-access
  CP Codes: All production CP codes
  Fields to capture:
    - timestamp (epoch ms)
    - client_ip (real IP)
    - request_method
    - url (full path + query)
    - status_code
    - bytes_sent
    - cache_status (TCP_HIT, TCP_MISS, TCP_MEM_HIT, etc.)
    - arl (Akamai request ID)
    - edge_ip
    - country_code
    - asn
    - user_agent
    - referer
    - response_time_ms
    - waf_action (allow/deny/alert)
    - bot_score (if Bot Manager attached)
    - cp_code
    - surrogate_key (PARTIAL — only available if configured)

Delivery:
  Destination: S3 bucket (akamai-logs-prod-raw)
  Format: JSON newline-delimited
  Compression: gzip
  Frequency: every 30 seconds
  
Fallback if S3 unavailable:
  Retry: 3 attempts, exponential backoff
  Overflow: Akamai internal buffer (limited; if full logs dropped — monitor)
```

---

## Fast Purge API Integration

### Credentials

```
Purge API credentials stored in AWS Secrets Manager / HashiCorp Vault:
  - Host: akab-<id>.luna.akamaiapis.net
  - Client token: akab-client-token
  - Client secret: <secret>
  - Access token: akab-access-token
  
Permissions scope: Purge only (CPCode purge + tag purge + URL purge)
NOT given: Property management, user management, contract access

Separate credentials per environment:
  - purge-credentials-production
  - purge-credentials-staging
```

### Purge API Calls

```bash
# Invalidate by cache tag (PREFERRED)
POST https://{host}/ccu/v3/invalidations/tag/production
Authorization: EG1-HMAC-SHA256 ...
Content-Type: application/json
{
  "objects": ["article:uuid-123", "listing:articles", "page:my-article-slug"]
}

# Response:
{
  "httpStatus": 201,
  "detail": "Request accepted",
  "estimatedSeconds": 5,
  "purgeId": "abc-def-123",
  "supportId": "17SY3AK4..."
}

# Check purge status
GET https://{host}/ccu/v3/purges/abc-def-123
{
  "httpStatus": 200,
  "purgeId": "abc-def-123",
  "detail": "Done",
  "completionTime": "2026-04-27T10:00:05.000Z"
}

# Invalidate by URL (use when tag purge not available)
POST https://{host}/ccu/v3/invalidations/url/production
{
  "objects": ["https://www.example.com/articles/my-article"]
}

# Delete by CP code (EMERGENCY ONLY — nuclear option)
POST https://{host}/ccu/v3/delete/cpcode/production
{
  "objects": ["12345"]
}
```

### Rate Limits

```
Fast Purge rate limits (verify with account team):
  - URL/tag purge: 50,000 objects per second
  - CP code purge: unlimited (but use carefully)
  
Purge worker rate limiting:
  - Batch tags: max 1000 tags per API call
  - Queue: max 10 concurrent purge API requests
  - Retry: 3 attempts with 2s, 4s, 8s backoff
  - If rate limited (429): exponential backoff, do not drop
```

---

## Staging vs Production Activation Workflow

```
Akamai has two networks: STAGING and PRODUCTION
  - Staging: test.example.com.edgesuite-staging.net (overridable via hosts file or DNS)
  - Production: live traffic

CI/CD process:
  1. Terraform apply → creates new property version
  2. Activate to STAGING network
  3. Wait for activation (poll Akamai Activation API, typically 5-15 min)
  4. Run automated validation against staging network:
     - Cache behavior tests (expect TCP_HIT on 2nd request)
     - Header tests (security headers present)
     - Redirect tests
     - WAF tests (known-bad payloads → expect block)
     - Purge test (submit tag purge, verify cache miss)
  5. Gate: all tests pass → proceed
  6. Human approval (for production) OR auto-promote (for staging deploys)
  7. Activate to PRODUCTION network
  8. Monitor DataStream for anomalies (5 min burn-in window)
  9. If error rate spikes: rollback to previous version
     POST /papi/v1/properties/{id}/versions/{version}/activations
     with previousVersion
```

---

## EdgeWorkers Design

### EdgeWorker: Request Router

**Purpose:** Normalize cache key, apply locale/device logic, check EdgeKV for feature flags and redirects

```javascript
// edgeworkers/request-router.js
import { httpRequest } from 'http-request';
import { EdgeKV } from './edgekv.js';

export async function onClientRequest(request) {
  const ekv = new EdgeKV({ namespace: 'cms-config', group: 'redirects' });
  
  // 1. Check redirect table in EdgeKV
  const redirect = await ekv.getText({ item: request.path });
  if (redirect) {
    const { location, status } = JSON.parse(redirect);
    request.respondWith(status, {}, '');
    request.setResponseHeader('Location', location);
    return;
  }
  
  // 2. Maintenance mode check
  const maintenance = await ekv.getText({ item: 'maintenance-mode' });
  if (maintenance === 'true') {
    request.respondWith(503, { 'Retry-After': '300' }, 'Service temporarily unavailable');
    return;
  }
  
  // 3. Normalize locale for cache key
  const acceptLang = request.getHeader('Accept-Language') || 'en';
  const locale = normalizeLocale(acceptLang); // 'en', 'fr', 'de', 'es', 'ja'
  request.setVariable('PMUSER_LOCALE', locale);
  
  // 4. Normalize device group for cache key
  const deviceType = request.getVariable('PMUSER_DEVICE_TYPE') || 'desktop';
  request.setVariable('PMUSER_DEVICE', deviceType);
}

function normalizeLocale(acceptLang) {
  const primary = acceptLang.split(',')[0].split(';')[0].trim().substring(0, 2).toLowerCase();
  const supported = ['en', 'fr', 'de', 'es', 'ja', 'zh', 'ko', 'pt', 'ar'];
  return supported.includes(primary) ? primary : 'en';
}
```

### EdgeKV Usage

```
Namespace: cms-config
  Group: redirects       → path:string → JSON{location, status}
  Group: feature-flags   → flag-name:string → 'true'|'false'
  Group: ab-tests        → test-name:string → JSON{variants, weights}
  Group: maintenance     → 'maintenance-mode' → 'true'|'false'
  Group: geo-blocks      → country-code:string → 'blocked'

Namespace: cms-tokens (NOT for sensitive data — preview token validation only)
  Group: preview-tokens  → token:string → JSON{entry_id, expires, site_id}

Update flow:
  CMS Admin → CMS API → EdgeKV Write API (server-side SDK)
  Propagation time: seconds (near-real-time)
  
IMPORTANT: Do NOT store PII, auth secrets, or payment data in EdgeKV.
           It is a low-latency config store, not a secure vault.
```

---

## Akamai Property Terraform (Draft)

See `infra/terraform/akamai/` for full Terraform resources. Key provider:

```hcl
terraform {
  required_providers {
    akamai = {
      source  = "akamai/akamai"
      version = "~> 5.0"
    }
  }
}

provider "akamai" {
  # Credentials from environment or .edgerc file
  edgerc         = "~/.edgerc"
  config_section = "default"
}

resource "akamai_property" "cms_www_production" {
  name        = "cms-production-www"
  contract_id = var.akamai_contract_id
  group_id    = var.akamai_group_id
  product_id  = "prd_SPM" # Ion Standard — verify product ID with account team
  
  hostnames {
    cname_from = "www.example.com"
    cname_to   = akamai_edge_hostname.www.edge_hostname
    cert_provisioning_type = "DEFAULT" # Akamai-managed cert
  }
  
  rule_format = "latest"
  rules       = data.akamai_property_rules_builder.cms_rules.json
}

resource "akamai_edge_hostname" "www" {
  product_id    = "prd_SPM"
  contract_id   = var.akamai_contract_id
  group_id      = var.akamai_group_id
  ip_behavior   = "IPV6_COMPLIANCE"
  edge_hostname = "www.example.com.edgesuite.net"
}
```

Full rule tree as JSON is managed via `akamai_property_rules_builder` data source or PAPI JSON — see `infra/akamai/rules/` for rule JSON templates.
