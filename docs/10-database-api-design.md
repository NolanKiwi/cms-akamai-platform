# Database and API Design

## Database Architecture

### PostgreSQL Configuration

```
Production setup:
  Primary: PostgreSQL 16 (write + read)
  Read Replica: 1-2 replicas for read-heavy operations (content listing, search prep)
  Connection pooling: PgBouncer (transaction mode, max 100 connections to primary)
  
Read/write split:
  Writes: content mutations, audit logs, purge logs → primary
  Reads: content listing, single entry, version history → read replica (with primary fallback)
  NestJS: TypeORM with custom ReplicationNamingStrategy
  
Backup:
  Continuous WAL archiving to S3 (pg_basebackup + WAL-G)
  Daily logical backup (pg_dump) to S3 (7-day retention hot, 90-day warm)
  Point-in-time recovery: up to 7 days (via WAL)
  
Extensions:
  - pg_trgm (trigram indexes for text search)
  - uuid-ossp (UUID generation)
  - btree_gin (GIN indexes for composite queries)
  - pg_stat_statements (query performance)
  
Indexes for common queries:
```

```sql
-- Content listing by site and type (most common query)
CREATE INDEX idx_entries_site_type_status 
  ON content_entries(site_id, content_type_id, status, updated_at DESC);

-- Slug lookup (public API)
CREATE INDEX idx_entries_slug_lookup 
  ON content_entries(site_id, slug, locale) WHERE status = 'published';

-- Scheduled content (scheduled publish worker)
CREATE INDEX idx_entries_scheduled 
  ON content_entries(scheduled_at, status) 
  WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

-- Full-text search on title (CMS admin search)
CREATE INDEX idx_versions_title_fts 
  ON content_versions USING gin(to_tsvector('english', fields->>'title'));

-- Cache tag lookup (purge dependency resolution)
CREATE INDEX idx_versions_cache_tags 
  ON content_versions USING gin(cache_tags);

-- Audit log queries
CREATE INDEX idx_audit_created 
  ON audit_logs(created_at DESC, site_id);

-- Purge log queries  
CREATE INDEX idx_purge_log_submitted 
  ON purge_log(submitted_at DESC);
```

### Redis Configuration

```
Cluster: 3 primary + 3 replica (6 nodes minimum)
Redis version: 7.x
Persistence: AOF (appendonly yes) for durability
Max memory policy: allkeys-lru (evict least recently used)
Max memory: 8GB per node (adjust based on usage)

Key namespaces:
  session:{session_id}           → User session data, TTL: 8h
  preview:token:{jti}            → Preview token revocation, TTL: 1h
  ratelimit:login:{ip}           → Login rate limit counter, TTL: 60s
  ratelimit:upload:{user_id}     → Upload rate limit, TTL: 60s
  ratelimit:api:{api_key}        → API key rate limit, TTL: 60s
  cache:entry:{id}               → CMS entry cache (origin-side), TTL: 5min
  cache:listing:{type}:{site}    → Content listing cache, TTL: 60s
  publish:lock:{entry_id}        → Distributed lock for publish atomicity, TTL: 30s
  search:recent:{user_id}        → Recent search terms, TTL: 24h
  
Redis Streams (for event bus, lightweight alternative to Kafka for MVP):
  cms:events → publish events, asset events, purge events
  Consumer groups:
    cms:events → purge-worker-cg
    cms:events → search-worker-cg
    cms:events → webhook-worker-cg
    cms:events → reporting-worker-cg
```

---

## API Design — Complete Specification

### Authentication Endpoints

```yaml
POST /api/v1/auth/login
  Request:
    {email: string, password: string}
  Response 200:
    {accessToken: string, expiresIn: 28800}
  Response 401:
    {error: "invalid_credentials"}
  Headers Set:
    Set-Cookie: session=<httponly-secure-samesite-strict>
  Rate Limit: 5/min per IP (Redis)

POST /api/v1/auth/logout
  Auth: Required
  Response 200: {}
  Side effect: Invalidates session cookie, Redis session key deleted

POST /api/v1/auth/refresh
  Auth: Refresh token in cookie
  Response 200:
    {accessToken: string, expiresIn: 28800}

GET /api/v1/auth/me
  Auth: Required
  Response 200:
    {id, email, name, sites: [{id, slug, role}]}
```

### Content CRUD

```yaml
# List entries (public + cached)
GET /api/v1/content/{type}
  Query: ?locale=en&page=1&size=20&sort=published_desc&category=tech&tag=cms&status=published
  Auth: Optional (public by default; authenticated for draft access)
  Cache: Surrogate-Control: max-age=120, Surrogate-Key: listing:{type}
  Response 200:
    {
      total: 142,
      page: 1,
      size: 20,
      items: [{id, slug, title, summary, publishedAt, heroImage, author, categories}]
    }

# Single entry (public + cached)
GET /api/v1/content/{type}/{slug}
  Query: ?locale=en
  Auth: Optional
  Cache: Surrogate-Control: max-age=300, Surrogate-Key: {type}:{id} page:{slug}
  Response 200:
    {id, slug, locale, title, body, ..., publishedAt, seo, cacheVersion}
  Response 404:
    {error: "not_found"}

# Create entry (admin)
POST /api/v1/admin/content/{type}
  Auth: Required (editor+)
  Request:
    {siteId: uuid, locale: string, fields: {title, body, ...}}
  Response 201:
    {id, slug, status: "draft", version: 1, createdAt}

# Update entry (admin)
PUT /api/v1/admin/content/{type}/{id}
  Auth: Required (editor+)
  Request:
    {fields: {title?, body?, ...}, locale?: string}
  Response 200:
    {id, slug, status, version, updatedAt}

# Get entry with all fields (admin)
GET /api/v1/admin/content/{type}/{id}
  Auth: Required
  Query: ?locale=en&version=5  (optional: specific version)
  Response 200:
    {id, slug, status, locale, version, fields, meta, cacheTags, createdAt, updatedAt, createdBy, updatedBy}

# Version history
GET /api/v1/admin/content/{type}/{id}/versions
  Auth: Required
  Response 200:
    {versions: [{version, publishedAt, publishedBy, status, fieldsSummary}]}

# Rollback
POST /api/v1/admin/content/{type}/{id}/rollback
  Auth: Required (publisher+)
  Request:
    {toVersion: 3, reason: "Reverted incorrect content"}
  Response 202:
    {jobId: uuid, message: "Rollback initiated"}
  Side effects:
    - Copies version fields to new version (n+1)
    - Sets status = published if was published
    - Triggers purge job
    - Writes audit log

# Publish
POST /api/v1/admin/content/{type}/{id}/publish
  Auth: Required (publisher+)
  Response 202:
    {jobId: uuid, estimatedPurgeSeconds: 5}

# Schedule publish
POST /api/v1/admin/content/{type}/{id}/schedule
  Auth: Required (publisher+)
  Request:
    {scheduledAt: "2026-05-01T09:00:00Z"}
  Response 202:
    {jobId: uuid, scheduledAt}

# Delete / Archive
DELETE /api/v1/admin/content/{type}/{id}
  Auth: Required (publisher+)
  Response 204
  Side effects: status = archived, URL purge for canonical URL
```

### Asset Upload

```yaml
# Request presigned upload URL
POST /api/v1/admin/assets/upload-url
  Auth: Required (editor+)
  Request:
    {filename: string, mimeType: string, size: number, siteId: uuid}
  Response 200:
    {
      uploadUrl: "https://s3.amazonaws.com/...",
      assetId: uuid,
      s3Key: string,
      expiresIn: 900
    }
  Validation:
    - mimeType in allowed list
    - size < limit for mimeType
    - Rate limit: 20/min per user

# Confirm upload complete
POST /api/v1/admin/assets/{id}/complete
  Auth: Required (editor+)
  Response 202:
    {assetId: uuid, status: "processing"}
  Side effects:
    - MIME re-validation
    - Malware scan (async)
    - Metadata extraction (async)
    - Thumbnail generation (async)

# Get asset
GET /api/v1/admin/assets/{id}
  Auth: Required
  Response 200:
    {id, filename, cdnUrl, mimeType, size, width, height, altText, focalPoint, tags, malwareScanned, malwareClean, uploadedAt}

# Update asset metadata
PATCH /api/v1/admin/assets/{id}
  Auth: Required (editor+)
  Request:
    {altText?, focalPointX?, focalPointY?, tags?, description?}
  Response 200: updated asset

# List assets (DAM)
GET /api/v1/admin/assets
  Query: ?siteId=&type=image&q=hero&page=1&size=50
  Auth: Required
  Response 200:
    {total, items: [...]}
```

### Video Registration

```yaml
POST /api/v1/admin/video
  Auth: Required (editor+)
  Request:
    {
      siteId: uuid,
      title: string,
      description?: string,
      geoRestriction?: {mode: "allow"|"deny", countries: string[]},
      tokenRequired?: boolean
    }
  Response 201:
    {id: uuid, status: "awaiting_upload"}

POST /api/v1/admin/video/{id}/upload-url
  Auth: Required (editor+)
  Response 200:
    {uploadUrl, s3Key, expiresIn: 3600}

POST /api/v1/admin/video/{id}/complete
  Auth: Required (editor+)
  Response 202:
    {status: "processing", estimatedMinutes: 15}

PATCH /api/v1/admin/video/{id}
  Auth: Required (editor+)
  Request: {title?, description?, thumbnailAssetId?, geoRestriction?, tokenRequired?}
  Response 200: updated video

GET /api/v1/video/{id}/token  # Public (authenticated users)
  Auth: Required (end-user auth)
  Response 200:
    {token: string, expiresAt: ISO8601, hlsUrl: string, dashUrl: string}
```

### Purge Endpoints

```yaml
# Manual purge by tags (operators)
POST /api/v1/admin/purge/tags
  Auth: Required (developer+)
  Request:
    {tags: string[], reason?: string}
  Response 202:
    {jobId: uuid, tagCount: number, estimatedSeconds: 5}

# Manual purge by URLs
POST /api/v1/admin/purge/urls
  Auth: Required (developer+)
  Request:
    {urls: string[], reason?: string}
  Response 202:
    {jobId: uuid, urlCount: number, estimatedSeconds: 5}

# Purge status
GET /api/v1/admin/purge/{jobId}
  Auth: Required
  Response 200:
    {jobId, status: "submitted"|"in_progress"|"complete"|"failed", latencyMs, submittedAt, completedAt}

# Purge history
GET /api/v1/admin/purge
  Auth: Required
  Query: ?page=1&size=50&triggerType=publish&status=complete&since=2026-04-01
  Response 200:
    {total, items: [{purgeId, triggerType, scope, objectCount, status, latencyMs, submittedAt}]}

# Cache tag dependency lookup
GET /api/v1/admin/purge/dependencies
  Query: ?tag=article:uuid-123
  Auth: Required
  Response 200:
    {tag: "article:uuid-123", dependentTags: ["page:my-article", "listing:articles", "sitemap"]}
```

### Redirect Management

```yaml
GET /api/v1/admin/redirects
  Auth: Required
  Query: ?siteId=&page=1&size=100&q=old-path
  Response 200:
    {total, items: [{id, fromPath, toUrl, statusCode, isActive}]}

POST /api/v1/admin/redirects
  Auth: Required (developer+)
  Request:
    {siteId, fromPath: "/old/path", toUrl: "/new/path", statusCode: 301, isRegex: false}
  Response 201: created redirect
  Side effects: Update EdgeKV redirect table

PUT /api/v1/admin/redirects/{id}
  Auth: Required (developer+)
  Response 200: updated redirect
  Side effects: Update EdgeKV

DELETE /api/v1/admin/redirects/{id}
  Auth: Required (developer+)
  Response 204
  Side effects: Remove from EdgeKV

# Bulk import
POST /api/v1/admin/redirects/import
  Auth: Required (developer+)
  Content-Type: text/csv
  Body: CSV with headers: from_path,to_url,status_code
  Response 202: {jobId, count: 500}
```

### Reporting Query

```yaml
GET /api/v1/admin/reports/traffic
  Auth: Required
  Query: ?start=2026-04-01&end=2026-04-27&cpCode=CP-002&interval=hour
  Response 200:
    {
      summary: {totalRequests, totalBytes, cacheHitRatio, avgResponseMs},
      series: [{timestamp, requests, bytes, cacheHits, cacheMisses, errors}]
    }

GET /api/v1/admin/reports/content
  Auth: Required
  Query: ?siteId=&start=2026-04-01&end=2026-04-27
  Response 200:
    {
      publishedCount: 42,
      publishedByType: {article: 30, page: 12},
      avgPublishLatencyMs: 18000,
      editorActivity: [{userId, publishCount, lastActive}]
    }

GET /api/v1/admin/reports/purge
  Auth: Required
  Query: ?start=&end=&status=complete
  Response 200:
    {
      totalPurges: 156,
      avgLatencyMs: 4800,
      p95LatencyMs: 8200,
      failureCount: 2,
      byTriggerType: {publish: 140, manual: 14, emergency: 2}
    }
```

### Webhook Endpoints

```yaml
# List webhook configurations
GET /api/v1/admin/settings/webhooks
  Auth: Required (admin+)

# Create webhook
POST /api/v1/admin/settings/webhooks
  Auth: Required (admin+)
  Request:
    {
      siteId: uuid,
      url: "https://partner.example.com/cms-hook",
      events: ["content.published", "content.unpublished"],
      secret: string
    }
  Response 201: {id, url, events, active: true}

# Test webhook
POST /api/v1/admin/settings/webhooks/{id}/test
  Auth: Required (admin+)
  Response 200: {statusCode, responseTime, success}

# Inbound webhook (from CI/CD or external triggers)
POST /api/v1/webhooks/deploy
  Auth: HMAC-SHA256 signature validation (X-Webhook-Signature)
  Request:
    {event: "deployment.completed", environment: "staging", commit: string}
  Response 200: {}
  Side effects: Trigger cache warm-up for key URLs
```

---

## API Rate Limiting Implementation

```typescript
// Using nestjs-rate-limiter with Redis
// packages/security/src/rate-limit.guard.ts

import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Redis } from 'ioredis';

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  // Per-endpoint limits:
  // /auth/login: 5/min
  // /admin/assets/upload-url: 20/min
  // Default public API: 1000/min per API key
  // Default admin API: 300/min per user
  
  protected getTracker(req: Record<string, any>): string {
    // For auth endpoints: track by IP
    if (req.path.startsWith('/api/v1/auth')) {
      return `ip:${req.ip}`;
    }
    // For admin endpoints: track by user ID
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    // For public API: track by API key
    if (req.headers['x-api-key']) {
      return `apikey:${req.headers['x-api-key']}`;
    }
    return `ip:${req.ip}`;
  }
}
```

---

## Response Envelope Design

```typescript
// Consistent response format
interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    size?: number;
    total?: number;
    version?: string;
  };
}

interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string[]>;  // field-level validation errors
  traceId?: string;
}

// Error codes:
// 400 bad_request
// 401 unauthorized
// 403 forbidden
// 404 not_found
// 409 conflict (e.g., slug already exists)
// 422 validation_error
// 429 rate_limit_exceeded
// 503 service_unavailable
```

---

## OpenAPI / Swagger Integration

```typescript
// main.ts — NestJS Swagger setup
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('CMS API')
  .setVersion('1.0')
  .addBearerAuth()
  .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, 'api-key')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);

// Generated spec available at: /api/docs (Swagger UI)
// JSON spec at: /api/docs-json
// Used for: API contract tests, client SDK generation, Akamai API definition
```
