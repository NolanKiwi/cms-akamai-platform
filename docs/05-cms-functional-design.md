# CMS Functional Design

## Admin Console Architecture

### Technology Choice
- **Framework:** Next.js 14 (App Router) — server components for fast initial load, client components for interactive editor
- **UI Library:** shadcn/ui + Tailwind CSS — accessible, customizable
- **Rich Text Editor:** Tiptap (ProseMirror-based) — extensible, supports custom nodes for CMS blocks
- **Asset Browser:** Custom React component with S3/media API integration
- **Auth:** NextAuth.js with OIDC provider (Google Workspace, Okta, Azure AD)

### Access Control Architecture

```
Roles (hierarchical, site-scoped):
  admin       → full access including user management, site config, all content types
  developer   → content types, field schema, redirects, webhooks, API keys, all content
  publisher   → approve + publish content; cannot modify schema
  editor      → create/edit drafts; submit for review; upload assets; cannot publish
  viewer      → read-only access to content and dashboards

Per-site role assignment:
  user_id + site_id + role_id
  A user can be admin on Site A and editor on Site B

Permission checks:
  - JWT contains: {user_id, sites: [{site_id, role}]}
  - CMS API validates per-endpoint permission decorators
  - Row-level: site_id always included in WHERE clause for tenant isolation
```

### Admin Console Pages

```
/dashboard              → editor activity, publish queue, recent content
/content/{type}         → list view with filters, search, status, locale
/content/{type}/new     → new entry form
/content/{type}/{id}    → edit entry (fields, SEO, scheduling, workflow)
/content/{type}/{id}/versions → version history, diff view, rollback UI
/assets                 → DAM: grid/list view, upload, search, metadata edit
/assets/{id}            → asset detail: metadata, usage, crop/focal point, derivatives
/video                  → video asset list
/video/{id}             → video detail: stream URLs, thumbnail, geo, token config
/redirects              → redirect management table, bulk import
/menus                  → menu builder (tree UI)
/localization           → locale management, translation status grid
/sites                  → multi-site config (admin only)
/users                  → user management (admin only)
/settings/webhooks      → webhook endpoint config
/settings/api-keys      → API key management for delivery API
/settings/content-types → content type schema editor (developer only)
/operations/purge       → manual purge UI, purge history
/operations/audit       → audit log viewer
/operations/publish-queue → scheduled publish status
/reports/traffic        → Akamai CDN reports (embedded Grafana/DataStream)
/reports/content        → editorial activity, publish metrics
/reports/search         → search analytics
```

---

## Editorial Workflow State Machine

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
              ┌─────▼──────┐                                  │
   New entry → │   DRAFT    │ ← Rollback (copies old version) │
              └─────┬──────┘                                  │
                    │ Submit for review                        │
              ┌─────▼──────┐                                  │
              │ IN_REVIEW  │ ← Request changes                 │
              └─────┬──────┘                                  │
          ┌─────────┼─────────┐                               │
          │ Reject  │ Approve │                               │
          │  (→     │         │                               │
          │ DRAFT)  │         │                               │
          └─────────┼─────────┘                               │
              ┌─────▼──────┐                                  │
    Publish → │ SCHEDULED  │ ← Schedule publish time          │
    now        │  (future)  │                                  │
    │          └─────┬──────┘                                  │
    │                │ Scheduled time reached                  │
    │          ┌─────▼──────┐                                  │
    └────────→ │ PUBLISHED  │──────────────────────────────────┘
               └─────┬──────┘
                     │ Archive
               ┌─────▼──────┐
               │  ARCHIVED  │
               └────────────┘

State transitions emit events → publisher-worker queue
Publisher worker triggers:
  1. Content freeze (set published_at, increment version)
  2. Search index update
  3. Cache purge (via purge-worker)
  4. Webhook delivery
  5. Audit log entry
  6. Sitemap regeneration (async)
```

---

## Content Preview Architecture

### Preview Token System

```
Preview URL: https://preview.example.com/api/preview?token=<jwt>

Token generation (CMS API):
  JWT payload: {
    sub: "preview",
    entry_id: "uuid",
    version: 5,              // specific version to preview
    site_id: "uuid",
    locale: "en",
    exp: now + 3600,          // 1 hour expiry
    iat: now,
    jti: "random-uuid"        // prevent reuse
  }
  Signed with: PREVIEW_JWT_SECRET (separate from auth secret)
  
  Stored in Redis: preview:token:{jti} = {entry_id, ...}
  (allows explicit revocation)

Preview server (Next.js):
  1. Receives token in query string
  2. Validates JWT signature and expiry
  3. Validates token not revoked (Redis check)
  4. Sets Next.js draft mode / preview cookie
  5. Redirects to content URL
  6. Next.js fetches from CMS API with draft=true header
  7. CMS API returns DRAFT version of content (bypasses published_only filter)
  8. Response: Cache-Control: no-store, private (never cached)
  
Akamai rule: Preview bypass
  Match: Hostname = preview.example.com OR Header X-Preview-Token present
  Behavior: No cache, forward all cookies, no bot check, no WAF aggressive rules
```

---

## Media / DAM Architecture

### Upload Flow

```
1. Editor selects file in admin console
2. Admin console → POST /api/v1/admin/assets/upload-url
   Body: {filename, mimeType, size, siteId}
3. CMS API validates:
   - Allowed MIME types: image/*, video/*, application/pdf, application/zip, etc.
   - File size limit: 500MB per file, configurable per type
   - Rate limit: 20 uploads/minute per user
4. CMS API generates presigned S3 PUT URL (15 minute expiry)
5. Returns: {uploadUrl, assetId, key}
6. Admin console → PUT directly to S3 presigned URL (bypass CMS API for large files)
7. On upload complete → admin console → POST /api/v1/admin/assets/{id}/complete
8. CMS API:
   a. Fetches object from S3, validates MIME type (don't trust client)
   b. Runs malware scan (ClamAV sidecar or cloud virus scanning service)
   c. Extracts metadata (dimensions, duration, EXIF for images)
   d. Strips EXIF metadata from images (privacy)
   e. Generates thumbnail (if image or video)
   f. Creates media_assets record
   g. Emits asset.uploaded event
9. CDN URL set on asset: https://cdn.example.com/assets/{site_id}/{year}/{month}/{filename}
```

### Media Storage Structure (S3)

```
s3://cms-media-production/
├── originals/
│   └── {site_id}/
│       └── {year}/
│           └── {month}/
│               └── {asset_id}-{original_filename}
├── thumbnails/
│   └── {asset_id}-{width}x{height}.jpg
└── documents/
    └── {site_id}/
        └── {asset_id}-{filename}

Lifecycle policies:
  originals/ → Standard storage; no expiry (permanent)
  thumbnails/ → Standard storage; 90-day cleanup if not accessed (optional)
  
Versioning: Enabled on originals/ bucket (accidental delete protection)
```

---

## Multi-Language / Multi-Site Design

### Site Isolation

```
All database queries scoped by site_id:
  SELECT * FROM content_entries WHERE site_id = $1 AND ...

Sites can share:
  - Content types (global content type library)
  - Media assets (optional: shared DAM with access control)

Sites cannot share:
  - Content entries (fully isolated)
  - Redirects
  - Menus
  - User roles (separate per-site assignments)
```

### Locale Strategy

```
Locale stored per content entry:
  {entry_id, site_id, content_type_id, slug, locale}

Translation workflow:
  1. Master entry created in default_locale (e.g., en)
  2. Editor initiates translation → creates new entry with same slug, different locale
  3. Translation entry linked to master via locale_group_id
  4. Translator fills localized fields
  5. Independent publish state per locale (en can be published, fr still draft)

Akamai cache key:
  locale bucket derived from Accept-Language normalized to supported locales
  Custom cache key dimension: PMUSER_LOCALE
  
URL strategy options:
  a. Path prefix: /en/articles/slug, /fr/articles/slug  ← RECOMMENDED
  b. Subdomain: en.example.com, fr.example.com
  c. Domain: example.com, example.fr
```

---

## API-First Architecture

### REST API Overview

```
Base URL: https://api.example.com/api/v1

Public endpoints (cached at Akamai):
  GET  /content/{type}                     → list entries
  GET  /content/{type}/{slug}              → single entry by slug
  GET  /content/{type}/{slug}/related      → related content
  GET  /search?q=&type=&locale=            → search
  GET  /assets/{id}                        → asset metadata
  GET  /navigation/{menu_slug}             → menu structure
  GET  /redirects?path=                    → redirect lookup

Admin endpoints (internal network only):
  POST /admin/content/{type}               → create entry
  PUT  /admin/content/{type}/{id}          → update entry
  POST /admin/content/{type}/{id}/publish  → publish
  POST /admin/content/{type}/{id}/schedule → schedule
  POST /admin/content/{type}/{id}/rollback → rollback to version
  DELETE /admin/content/{type}/{id}        → archive
  GET  /admin/content/{type}/{id}/versions → version history
  
  POST /admin/assets/upload-url            → get presigned upload URL
  POST /admin/assets/{id}/complete         → confirm upload
  
  POST /admin/purge/tags                   → manual tag purge
  POST /admin/purge/urls                   → manual URL purge
  GET  /admin/purge/{id}                   → purge status
  
  GET  /admin/audit                        → audit log query
```

### GraphQL (Optional, Phase 2+)

```graphql
type Query {
  article(slug: String!, locale: String = "en"): Article
  articles(
    page: Int = 1
    size: Int = 20
    locale: String = "en"
    category: String
    tag: String
    sort: ArticleSort = PUBLISHED_DESC
  ): ArticleList
  
  page(slug: String!, locale: String = "en"): Page
  navigation(slug: String!, locale: String = "en"): Navigation
  search(query: String!, locale: String, types: [ContentType]): SearchResults
}

type Article {
  id: ID!
  slug: String!
  title: String!
  summary: String
  body: RichText
  heroImage: MediaAsset
  author: Author
  categories: [Category]
  tags: [String]
  publishedAt: DateTime
  seo: SEOFields
  cacheControl: CacheControl @cacheControl(maxAge: 300)
}
```

### Webhook Events

```
Outbound webhooks triggered by:
  content.published    → payload: {event, site_id, entry_id, type, slug, version}
  content.unpublished  → same
  content.deleted      → same
  asset.uploaded       → payload: {event, site_id, asset_id, url, type}
  purge.completed      → payload: {event, purge_id, tags, latency_ms}
  
Delivery:
  - HTTPS POST to configured endpoint
  - Signed with HMAC-SHA256 using webhook secret (X-Webhook-Signature header)
  - Retry: 3 attempts (1min, 5min, 15min backoff)
  - Dead-letter queue after 3 failures
  - Idempotency key: X-Webhook-Id header (event UUID)
```

---

## Search Indexing Pipeline

```
Search engine: OpenSearch (combined with log analytics cluster, or separate)
Indices:
  cms-articles-{locale}     → one index per locale for optimal analyzer
  cms-pages-{locale}
  cms-products-{locale}

Indexing flow:
  1. Content published → publisher-worker emits search.index event to queue
  2. Search-worker consumes event
  3. Fetches content from CMS API (published version)
  4. Transforms to search document:
     {id, type, slug, title, summary, body_text, tags, categories, locale, published_at}
  5. Indexes to OpenSearch
  6. If content unpublished/deleted: removes from index

Search document schema:
  {
    id: "uuid",
    type: "article",
    slug: "my-article",
    title: "My Article Title",
    summary: "...",
    body_text: "...",           // HTML stripped to plain text
    tags: ["tag1"],
    categories: ["cat1"],
    locale: "en",
    site_id: "uuid",
    published_at: "ISO8601",
    weight: 1.0,               // editorial weight boost (optional)
    thumbnail_url: "...",
    author_name: "..."
  }

Search API:
  GET /api/v1/search?q=query&locale=en&type=article&page=1&size=20
  Returns: {total, hits: [{score, source: {...}}]}
  
Note: search endpoint NOT cached at Akamai (query diversity makes caching ineffective)
```

---

## Scheduling System

```
Scheduled publish:
  - Editor sets scheduled_at timestamp on entry
  - Status set to SCHEDULED
  - publish_jobs row created with scheduled_for = scheduled_at
  - Publisher worker polls every 60s for due jobs:
    SELECT * FROM publish_jobs WHERE scheduled_for <= NOW() AND status = 'pending'
  - For each due job: execute publish flow
  - On success: update status = 'complete'
  - On failure: increment attempts, set next retry (max 3 attempts)
  - On max retries: status = 'failed', notify operator via alert channel

Time zone handling:
  - All timestamps stored as UTC in database
  - Admin console displays in user's timezone (browser timezone or profile preference)
  - Scheduling UI converts local time to UTC before submitting
```

---

## Audit Log System

```
All mutations write to audit_logs table:
  - Via AuditInterceptor in NestJS (applied globally to admin routes)
  - Captures: before/after state (JSON diff), user_id, IP, user-agent, timestamp

Audit log retention:
  - Hot: PostgreSQL → 90 days online
  - Warm: Export to S3 JSON files → 2 years (Parquet for efficient querying)
  - Query via admin console or direct OpenSearch queries

Audit log viewer:
  - Filter by: entity_type, action, user, date range
  - Diff view: shows field-level changes
  - Non-repudiation: logs are append-only (no update/delete on audit_logs table)
  - Separate read-only role for audit log access

GDPR/privacy note:
  - User IP in audit logs is legitimate interest basis for security
  - User deletion: anonymize user_id in audit logs (replace with "DELETED_USER_{hash}")
  - Document in privacy policy
```
