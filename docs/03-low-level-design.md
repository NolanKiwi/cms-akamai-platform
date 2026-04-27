# Low-Level Design

## Component-by-Component Design

### 1. CMS API (NestJS)

**Modules:**
```
cms-api/
├── auth/           # JWT, OAuth/OIDC, session management
├── users/          # User management, RBAC
├── content/        # Content CRUD, versioning, workflow
├── assets/         # Media upload, metadata, DAM
├── video/          # Video registration, streaming config
├── publishing/     # Publish pipeline, state machine
├── purge/          # Purge request generation and tracking
├── redirects/      # Redirect management
├── search/         # Search indexing pipeline
├── webhooks/       # Outbound webhook delivery
├── localization/   # Locale management, translations
├── audit/          # Audit log storage and query
├── preview/        # Preview token generation and validation
├── reporting/      # Internal reporting queries
└── health/         # Health check, readiness probe
```

**API Boundaries:**
- `/api/v1/*` — Public content delivery API (read-only, cached at Akamai)
- `/api/v1/admin/*` — Admin API (authenticated, internal network only)
- `/api/v1/preview/*` — Preview API (short-lived token, not cached)
- `/api/v1/webhooks/*` — Inbound webhook endpoints (HMAC validated)

---

### 2. Database Schema Draft (PostgreSQL)

```sql
-- Sites (multi-site support)
CREATE TABLE sites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(64) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  locales     TEXT[] DEFAULT '{"en"}',
  default_locale VARCHAR(8) DEFAULT 'en',
  hostname    VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Content Types
CREATE TABLE content_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID REFERENCES sites(id),
  slug        VARCHAR(64) NOT NULL,       -- 'article', 'page', 'product'
  name        VARCHAR(255),
  schema      JSONB NOT NULL,             -- field definitions
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, slug)
);

-- Content Entries (all content types share this table)
CREATE TABLE content_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) NOT NULL,
  content_type_id UUID REFERENCES content_types(id) NOT NULL,
  slug            VARCHAR(512) NOT NULL,
  locale          VARCHAR(8) DEFAULT 'en',
  status          VARCHAR(32) DEFAULT 'draft', -- draft|in_review|scheduled|published|archived
  version         INTEGER DEFAULT 1,
  published_at    TIMESTAMPTZ,
  scheduled_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, content_type_id, slug, locale)
);

-- Content Versions (immutable version snapshots)
CREATE TABLE content_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        UUID REFERENCES content_entries(id) NOT NULL,
  version         INTEGER NOT NULL,
  fields          JSONB NOT NULL,           -- all field values
  meta            JSONB,                    -- SEO, OG, schema.org
  cache_tags      TEXT[],                  -- surrogate keys for this version
  published_by    UUID REFERENCES users(id),
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_id, version)
);

-- Current published version pointer
CREATE TABLE content_published (
  entry_id         UUID PRIMARY KEY REFERENCES content_entries(id),
  version_id       UUID REFERENCES content_versions(id),
  published_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Media Assets
CREATE TABLE media_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) NOT NULL,
  filename        VARCHAR(512) NOT NULL,
  original_key    VARCHAR(1024) NOT NULL,   -- S3 key for original
  cdn_url         VARCHAR(1024),            -- public CDN URL
  mime_type       VARCHAR(128),
  file_size       BIGINT,
  width           INTEGER,
  height          INTEGER,
  duration_ms     INTEGER,                 -- for video/audio
  alt_text        VARCHAR(512),
  focal_point_x   FLOAT,
  focal_point_y   FLOAT,
  metadata        JSONB,
  tags            TEXT[],
  uploaded_by     UUID REFERENCES users(id),
  uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
  malware_scanned BOOLEAN DEFAULT false,
  malware_clean   BOOLEAN
);

-- Video Assets
CREATE TABLE video_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) NOT NULL,
  title           VARCHAR(512),
  media_asset_id  UUID REFERENCES media_assets(id),
  stream_type     VARCHAR(16) DEFAULT 'vod',  -- vod|live
  hls_url         VARCHAR(1024),
  dash_url        VARCHAR(1024),
  thumbnail_url   VARCHAR(1024),
  duration_ms     INTEGER,
  geo_restriction JSONB,                   -- {allow: ["US","CA"]} or {deny: ["CN"]}
  token_required  BOOLEAN DEFAULT false,
  status          VARCHAR(32) DEFAULT 'processing', -- processing|ready|error
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Redirects
CREATE TABLE redirects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID REFERENCES sites(id) NOT NULL,
  from_path   VARCHAR(2048) NOT NULL,
  to_url      VARCHAR(2048) NOT NULL,
  status_code SMALLINT DEFAULT 301,
  is_regex    BOOLEAN DEFAULT false,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, from_path)
);

-- Users and RBAC
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  name        VARCHAR(255),
  sso_id      VARCHAR(512),               -- external IdP subject
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(64) UNIQUE NOT NULL, -- admin|developer|publisher|editor|viewer
  permissions JSONB NOT NULL               -- {content: [read,write,publish], assets: [...]}
);

CREATE TABLE user_site_roles (
  user_id     UUID REFERENCES users(id),
  site_id     UUID REFERENCES sites(id),
  role_id     UUID REFERENCES roles(id),
  PRIMARY KEY(user_id, site_id, role_id)
);

-- Audit Log
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  site_id     UUID REFERENCES sites(id),
  entity_type VARCHAR(64),               -- content_entry|media_asset|redirect|user|config
  entity_id   UUID,
  action      VARCHAR(64),               -- create|update|publish|rollback|delete|purge
  before      JSONB,
  after       JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);

-- Purge Audit
CREATE TABLE purge_log (
  id              BIGSERIAL PRIMARY KEY,
  purge_id        VARCHAR(128),           -- Akamai purgeId
  trigger_type    VARCHAR(32),            -- publish|manual|scheduled|emergency
  trigger_entity  VARCHAR(128),          -- entry_id, asset_id, etc.
  purge_type      VARCHAR(16),           -- invalidate|delete
  scope           VARCHAR(16),           -- tag|url|cpcode
  objects         TEXT[],                -- tags or URLs purged
  status          VARCHAR(32) DEFAULT 'submitted', -- submitted|in_progress|complete|failed
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  latency_ms      INTEGER,
  error_message   TEXT
);

-- Workflow / Publishing Queue
CREATE TABLE publish_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        UUID REFERENCES content_entries(id),
  action          VARCHAR(32),           -- publish|unpublish|schedule
  scheduled_for   TIMESTAMPTZ,
  status          VARCHAR(32) DEFAULT 'pending',
  attempts        INTEGER DEFAULT 0,
  last_error      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_entries_status ON content_entries(site_id, status);
CREATE INDEX idx_entries_scheduled ON content_entries(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_entries_slug ON content_entries(site_id, slug, locale);
CREATE INDEX idx_versions_entry ON content_versions(entry_id, version DESC);
```

---

## Content Model Draft

### Standard Field Types
```json
{
  "fieldTypes": [
    "text", "rich_text", "markdown", "integer", "float", "boolean",
    "date", "datetime", "media_reference", "content_reference",
    "location", "json", "slug", "url", "email", "select",
    "multi_select", "tags", "color", "code_snippet"
  ]
}
```

### Article Content Type
```json
{
  "slug": "article",
  "name": "Article",
  "fields": [
    {"name": "title",         "type": "text",             "required": true, "localized": true},
    {"name": "slug",          "type": "slug",             "required": true, "localized": true, "source": "title"},
    {"name": "summary",       "type": "text",             "localized": true, "max_length": 300},
    {"name": "body",          "type": "rich_text",        "localized": true},
    {"name": "hero_image",    "type": "media_reference",  "accept": ["image/*"]},
    {"name": "author",        "type": "content_reference","target_type": "author"},
    {"name": "categories",    "type": "multi_select",     "options_source": "taxonomy:category"},
    {"name": "tags",          "type": "tags"},
    {"name": "published_date","type": "datetime"},
    {"name": "seo_title",     "type": "text",             "localized": true, "max_length": 70},
    {"name": "seo_description","type": "text",            "localized": true, "max_length": 160},
    {"name": "og_image",      "type": "media_reference",  "accept": ["image/*"]},
    {"name": "canonical_url", "type": "url"},
    {"name": "schema_markup", "type": "json"}
  ],
  "cache_tags_template": ["article:{id}", "author:{author.id}", "category:{categories}", "listing:articles"]
}
```

---

## Cache Key Matrix

| Content Type | Cache Key Components | TTL (Edge) | TTL (Browser) | Vary Headers | Surrogate Keys |
|---|---|---|---|---|---|
| Static JS/CSS (hashed) | path | 365d | 365d (immutable) | Accept-Encoding | none needed |
| Static images (hashed) | path | 365d | 30d | Accept-Encoding | none needed |
| Uploaded media originals | path | 30d | 7d | Accept-Encoding | asset:{id} |
| Image derivatives (IVM) | path + transform params | 30d | 7d | Accept | asset:{id} |
| HTML page (public SSR) | path + locale + device | 5min | no-cache | none (normalized) | page:{slug} + content refs |
| Article detail | path + locale + device | 5min | no-cache | none | article:{id} page:{slug} |
| API list endpoint | path + query allowlist + locale | 2min | no-cache | none | listing:{type} |
| API detail endpoint | path + locale | 5min | no-cache | none | {type}:{id} |
| HLS master manifest | path | 60s | no-cache | none | stream:{id} |
| HLS segment | path | 3600s | 1h | none | segment (no tag needed) |
| Redirect rules | N/A (edge rule) | indefinite | — | — | redirect:{id} |
| Search results | not cached at edge | 0 | no-cache | — | — |
| Authenticated pages | not cached | 0 | private,no-store | Cookie | — |
| Preview content | not cached | 0 | no-cache | — | — |

---

## TTL Matrix

| Scenario | Surrogate-Control (edge TTL) | Cache-Control (browser TTL) | Notes |
|---|---|---|---|
| Static asset (hashed filename) | max-age=31536000 | max-age=31536000, immutable | Deploy new hash to bust |
| Static asset (unhashed, e.g. robots.txt) | max-age=3600 | max-age=600 | Short browser TTL |
| Dynamic HTML (public article) | max-age=300 | no-cache | Purged on publish |
| Dynamic HTML (homepage) | max-age=60 | no-cache | High change frequency |
| CMS REST API response | max-age=120 | no-cache | Purged on publish |
| Image original | max-age=2592000 | max-age=604800 | Rarely changes |
| Image derivative (IVM) | max-age=2592000 | max-age=604800 | Purged on asset change |
| VOD HLS master | max-age=60 | no-cache | Allow manifest refresh |
| VOD HLS segment | max-age=3600 | max-age=3600 | Immutable once encoded |
| Live HLS segment | max-age=3 | no-cache | Real-time delivery |
| API (authenticated) | no-store | no-store, private | Never cached |
| Preview endpoint | no-store | no-store, private | Token-gated |

---

## Purge Tag Model

### Tag Naming Convention
```
{entity_type}:{entity_id}           # e.g., article:uuid-123
page:{slug}                          # e.g., page:homepage
listing:{content_type}               # e.g., listing:articles
template:{template_name}             # e.g., template:article-detail
menu:{menu_slug}                     # e.g., menu:main-nav
category:{category_slug}             # e.g., category:technology
sitemap                              # global sitemap tag
site:{site_id}                       # nuclear option: purge all for site
asset:{asset_id}                     # media asset
stream:{video_id}                    # video stream manifest
redirect:{redirect_id}               # redirect rule cache
```

### Purge Dependency Graph

```
Publish article:42
  → article:42
  → page:articles/my-article-slug
  → listing:articles (index pages)
  → category:technology (if categorized)
  → author:author-id (author page)
  → sitemap

Update menu:main-nav
  → menu:main-nav
  → template:layout (all pages using this layout — WARNING: broad)
  → OR: per-page tags if menu embedded in page cache

Update media asset (image used in articles)
  → asset:asset-id
  → article:42, article:99 (all entries referencing this asset)

Update redirect
  → redirect rules are applied at edge via EdgeWorker, purge EdgeKV entry

Delete content
  → Same as publish + explicit URL purge for canonical URLs
```

---

## Akamai Rule Matrix

| Rule Name | Match Criteria | Behavior Applied |
|---|---|---|
| Admin Bypass | Path begins with `/api/v1/admin/` | Forward to admin origin (internal LB); no cache; WAF bypass rule for admin IPs |
| Preview Bypass | Header `X-Preview-Token` present | Forward to preview origin; no cache; no bot check |
| Static Assets | Path matches `*.js`, `*.css`, `*.woff2`, `*.ico` | Cache 365d; compress brotli; no cookie forwarding; CP code: STATIC |
| Hashed Static Assets | Path matches `/static/` (or `/_next/static/`) | Cache 365d immutable; strip all cookies; CP code: STATIC-IMMUTABLE |
| Image Optimization | Path begins with `/images/` | IVM policy applied; WebP/AVIF negotiation; cache 30d; CP code: IMAGES |
| Dynamic HTML | Content-Type: text/html, path not in above | Surrogate-key cache; 5min TTL; normalize device/locale; CP code: DYNAMIC |
| Public API | Path begins with `/api/v1/content/` | Cache 120s; tag-based; strip auth cookies; CP code: API |
| VOD Streaming | Path begins with `/streams/vod/` | AMD behavior; token validation; CP code: STREAMING-VOD |
| Live Streaming | Path begins with `/streams/live/` | AMD behavior; low TTL; token validation; CP code: STREAMING-LIVE |
| Authenticated Routes | Cookie `session` present and path not static | No cache; forward cookie; CP code: DYNAMIC-AUTH |
| Redirect Rules | Path in EdgeKV redirect table | EdgeWorker redirect; 301/302; no origin request |
| Health Check | Path `/health` | Forward to origin; no cache; bypass WAF |
| Security Headers | All responses | Inject HSTS, CSP, X-Frame-Options, Referrer-Policy |
| Error Pages | Origin returns 5xx | Serve stale if available (SWR); serve cached error page after 3 retries |

---

## Security Policy Matrix

| Threat | Control Layer | Mechanism |
|---|---|---|
| DDoS (volumetric) | Akamai edge | Prolexic / built-in rate limiting |
| DDoS (application layer) | Akamai WAF | Rate control rules, slow POST detection |
| SQLi / XSS | Akamai WAF | App & API Protector rule sets |
| Bot scraping | Akamai Bot Manager | Bot score + CAPTCHA challenge |
| Credential stuffing | Akamai Bot Manager + WAF | Login endpoint rate limit + behavioral bot detection |
| CSRF | CMS API | SameSite=Strict cookies, CSRF tokens |
| Clickjacking | Akamai + origin | X-Frame-Options: DENY or SAMEORIGIN |
| Origin bypass | Site Shield | Firewall: allow only Akamai Site Shield CIDR |
| Admin console exposure | VPN + IP allowlist + MFA | Akamai access list rule; SSO OIDC |
| File upload abuse | CMS API | MIME validation, size limits, malware scan |
| SSRF (media import) | CMS API | URL allowlist for external imports |
| Token theft (video) | Akamai Token Auth | HMAC-signed tokens, short expiry, IP binding optional |
| Cache poisoning | Akamai rules | Query normalization, header normalization |
| Secret exposure | HashiCorp Vault / AWS Secrets Manager | No secrets in env files or code |
| TLS downgrade | Akamai TLS policy | TLS 1.2 minimum, prefer TLS 1.3, HSTS |
| Staging data leakage | Preview tokens | Separate preview hostname; token gated |

---

## Observability Event Schema

### Structured Log Format (OpenTelemetry / JSON)
```json
{
  "timestamp": "2026-04-27T10:00:00.000Z",
  "level": "info",
  "service": "cms-api",
  "trace_id": "abc123def456",
  "span_id": "789xyz",
  "event": "content.published",
  "user_id": "uuid",
  "site_id": "uuid",
  "entry_id": "uuid",
  "content_type": "article",
  "version": 5,
  "locale": "en",
  "duration_ms": 142,
  "cache_tags": ["article:uuid", "listing:articles"],
  "purge_job_id": "uuid"
}
```

### Key Events Emitted
| Event | Service | Fields |
|---|---|---|
| `content.created` | cms-api | user_id, site_id, entry_id, type, locale |
| `content.updated` | cms-api | user_id, entry_id, version, fields_changed[] |
| `content.published` | publisher-worker | entry_id, version, purge_tags[], latency_ms |
| `content.rolledback` | cms-api | entry_id, from_version, to_version, user_id |
| `purge.submitted` | purge-worker | purge_id, type, scope, object_count |
| `purge.completed` | purge-worker | purge_id, latency_ms, status |
| `asset.uploaded` | cms-api | asset_id, mime_type, size, scanned |
| `auth.login` | cms-api | user_id, ip, method, success |
| `auth.mfa_challenge` | cms-api | user_id, ip, result |
| `preview.token_created` | cms-api | entry_id, user_id, expires_at |
| `search.reindexed` | search-worker | entry_id, type, duration_ms |
| `webhook.delivered` | webhook-worker | endpoint, event_type, status_code, latency_ms |
