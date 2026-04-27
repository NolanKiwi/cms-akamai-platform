# Cache and Purge Strategy

## Purge Philosophy

**Default rule: prefer `invalidate` over `delete`.**

| Operation | Behavior | When to Use |
|---|---|---|
| `invalidate` | Object stays in cache but marked stale; re-fetched on next request | Default — guarantees fresh content without thundering herd |
| `delete` | Object removed from cache immediately; no fallback on next request | Only when stale content must not be served under any circumstances (e.g., GDPR removal, security incident) |

Invalidation means the next request to an edge node will trigger a re-fetch from origin while other nodes can still serve the (now-stale) object to concurrent requests during the brief re-fetch window. This provides graceful behavior during high traffic.

---

## Tag-Based Purge Architecture

### Why Tags over URLs

| Approach | Pros | Cons |
|---|---|---|
| URL purge | Simple, explicit | Must enumerate all URL variants (locale, pagination) |
| Tag purge | One tag → many URLs | Requires discipline in tag assignment; tag fan-out must be understood |
| CP code purge | Purge entire traffic class | Nuclear option; destroys all cache for business unit |

**Tag purge is the default.** URL purge used as fallback for edge cases.

---

## Tag Assignment Strategy

Every piece of content emits `Surrogate-Key` (or `Edge-Control: cache-tag=...`) headers:

```http
HTTP/1.1 200 OK
Content-Type: text/html
Surrogate-Control: max-age=300
Surrogate-Key: article:f3a2b1 page:articles/my-slug listing:articles category:technology author:ed-smith site:site1
```

### Tag Generation Rules

```typescript
// packages/akamai-client/src/tags.ts

export function generateCacheTags(entry: ContentEntry, version: ContentVersion): string[] {
  const tags: string[] = [];
  
  // Always: entity-level tag
  tags.push(`${entry.contentType}:${entry.id}`);
  
  // Always: page slug tag (primary cache key for HTML)
  tags.push(`page:${entry.slug}`);
  
  // Always: listing tag for this content type
  tags.push(`listing:${entry.contentType}`);
  
  // Always: site-level tag (for emergency purge)
  tags.push(`site:${entry.siteId}`);
  
  // Conditional: referenced entities
  const fields = version.fields;
  
  if (fields.author?.id)       tags.push(`author:${fields.author.id}`);
  if (fields.categories?.length) {
    fields.categories.forEach((c: string) => tags.push(`category:${c}`));
  }
  if (fields.template)          tags.push(`template:${fields.template}`);
  if (fields.heroImage?.id)     tags.push(`asset:${fields.heroImage.id}`);
  
  // SEO-specific
  tags.push(`sitemap`);
  
  return [...new Set(tags)]; // deduplicate
}
```

---

## Purge Dependency Graph

When entity X changes, we must purge all content that includes X:

```
article:{id} changes
  → purge: article:{id}, page:{slug}, listing:articles
  → if author changed: author:{author_id} (author page uses this article)
  → if category changed: category:{cat} (category listing uses this article)
  → sitemap (article list changed)

media asset:{id} changes
  → purge: asset:{id}
  → resolve: SELECT DISTINCT cache_tags FROM content_versions 
              WHERE tags @> ARRAY['asset:{id}']
  → purge all resolved tags (articles/pages that embed this asset)

menu:{slug} changes
  → purge: menu:{slug}
  → IF menu is layout-level (in every page): purge site:{site_id}
    WARNING: this is a broad purge — evaluate if truly necessary
  → OR: purge individual page tags if menu is embedded per-page

category:{slug} changes
  → purge: category:{slug}, listing:articles (if filtered list)
  → resolve: all articles in category → purge their tags

redirect:{id} changes
  → update EdgeKV entry (near-instant)
  → purge redirect cache if URL purge maintained at edge

template changes
  → purge: template:{template_name}
  → resolve: all entries using this template → purge their tags
  WARNING: can be very large fan-out; batch and rate-limit
```

---

## Purge Worker Implementation

```typescript
// apps/purge-worker/src/purge.worker.ts

import { InjectQueue, Process, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AkamaiPurgeClient } from '@cms/akamai-client';
import { PurgeLogService } from './purge-log.service';

interface PurgeJob {
  triggerType: 'publish' | 'manual' | 'scheduled' | 'emergency';
  triggerEntityId: string;
  tags: string[];
  scope: 'tag' | 'url';
  objects: string[];  // tags or URLs depending on scope
}

@Processor('purge')
export class PurgeWorker {
  private readonly BATCH_SIZE = 1000;  // Akamai API max objects per request
  private readonly MAX_CONCURRENT = 5;  // concurrent Akamai API calls

  constructor(
    private readonly akamaiClient: AkamaiPurgeClient,
    private readonly purgeLog: PurgeLogService,
  ) {}

  @Process({ concurrency: this.MAX_CONCURRENT })
  async handlePurge(job: Job<PurgeJob>): Promise<void> {
    const { triggerType, triggerEntityId, scope, objects } = job.data;
    
    // Log job start
    const logId = await this.purgeLog.create({
      triggerType,
      triggerEntity: triggerEntityId,
      scope,
      objects,
      status: 'submitted',
    });

    // Batch objects if needed
    const batches = this.chunk(objects, this.BATCH_SIZE);
    const purgeIds: string[] = [];
    
    for (const batch of batches) {
      const result = await this.akamaiClient.invalidate({
        scope,
        objects: batch,
        network: process.env.AKAMAI_NETWORK as 'production' | 'staging',
      });
      purgeIds.push(result.purgeId);
    }

    // Poll for completion
    const start = Date.now();
    const allComplete = await this.pollCompletion(purgeIds, 60_000); // 60s timeout
    const latencyMs = Date.now() - start;

    await this.purgeLog.update(logId, {
      status: allComplete ? 'complete' : 'timeout',
      purgeIds,
      latencyMs,
      completedAt: new Date(),
    });
  }

  private async pollCompletion(purgeIds: string[], timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    const pending = new Set(purgeIds);
    
    while (pending.size > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      
      for (const id of [...pending]) {
        const status = await this.akamaiClient.getPurgeStatus(id);
        if (status === 'Done') pending.delete(id);
      }
    }
    
    return pending.size === 0;
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) },
      (_, i) => arr.slice(i * size, i * size + size));
  }
}
```

---

## Akamai Fast Purge Client

```typescript
// packages/akamai-client/src/fast-purge.client.ts

import { EdgeGrid } from 'akamai-edgegrid';

interface PurgeRequest {
  scope: 'tag' | 'url' | 'cpcode';
  objects: string[];
  network: 'production' | 'staging';
  type?: 'invalidate' | 'delete';  // default: invalidate
}

interface PurgeResponse {
  purgeId: string;
  httpStatus: number;
  estimatedSeconds: number;
  detail: string;
}

export class AkamaiPurgeClient {
  private eg: EdgeGrid;

  constructor(private readonly config: {
    host: string;
    clientToken: string;
    clientSecret: string;
    accessToken: string;
  }) {
    this.eg = new EdgeGrid(
      config.clientToken,
      config.clientSecret,
      config.accessToken,
      config.host
    );
  }

  async invalidate(req: PurgeRequest): Promise<PurgeResponse> {
    const operation = req.type ?? 'invalidations';
    const path = `/ccu/v3/${operation}/${req.scope}/${req.network}`;
    
    return new Promise((resolve, reject) => {
      this.eg.auth({
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objects: req.objects }),
      });
      
      this.eg.send((error: any, response: any, body: any) => {
        if (error) return reject(error);
        if (response.statusCode !== 201) {
          return reject(new Error(`Purge failed: ${response.statusCode} ${body}`));
        }
        resolve(JSON.parse(body));
      });
    });
  }

  async getPurgeStatus(purgeId: string): Promise<'In-Progress' | 'Done' | 'Failed'> {
    const path = `/ccu/v3/purges/${purgeId}`;
    
    return new Promise((resolve, reject) => {
      this.eg.auth({ path, method: 'GET' });
      
      this.eg.send((error: any, response: any, body: any) => {
        if (error) return reject(error);
        const result = JSON.parse(body);
        resolve(result.detail === 'Done' ? 'Done' : 
                result.detail === 'Failed' ? 'Failed' : 'In-Progress');
      });
    });
  }
}
```

---

## Emergency Purge Button

```
Admin console: Operations → Emergency Purge

Options:
  1. Purge by URL (single or comma-separated)
     - Use case: specific URL has wrong content
     
  2. Purge by cache tag
     - Use case: asset changed, need to refresh all pages using it
     
  3. Purge all content for site (CP code purge)
     - Use case: major deployment, widespread content error
     - WARNING: causes mass cache invalidation → thundering herd risk
     - REQUIRES: dual approval (two operators confirm)
     - RATE-LIMITED: max once per 10 minutes per site
     
  4. Purge site CP code + static assets
     - Nuclear option: full cache clear
     - REQUIRES: senior engineer approval via PagerDuty acknowledgment
     
All emergency purges:
  - Logged to purge_log with trigger_type = 'emergency'
  - Logged to audit_logs
  - Sent to Slack #operations-alerts channel
  - Included in daily operations digest

UI safeguards:
  - Confirmation modal with impact summary ("This will purge ~50,000 URLs")
  - Operator must type "CONFIRM PURGE" to proceed
  - Rate limit: max 10 URL purges per user per hour
  - CP code purge: requires secondary approval
```

---

## Purge Rate Limit and Failure Handling

```
Akamai Fast Purge rate limits (approximate, confirm with account team):
  - URL/tag purge: 50,000 objects/second capacity
  - Objects per API call: 1000 (our enforced batch limit)
  - Concurrent API calls: 10 (our enforced limit: 5 to be conservative)

Our rate limiting:
  - BullMQ purge queue: max 5 concurrent workers
  - Each worker handles one batch (1000 tags) per Akamai API call
  - Total throughput: ~5000 tags/second (well within Akamai limits)
  
Failure handling:
  Rate limited (HTTP 429):
    - Retry with exponential backoff: 2s, 4s, 8s, 16s
    - Max 5 retries
    - If all retries fail: job moves to dead-letter queue
    - Dead-letter queue: operator notification, manual retry UI
    
  Network error:
    - Same retry strategy
    
  Partial success (some batches complete, some fail):
    - Failed batches retried independently
    - Successful purge IDs tracked in purge_log
    
  Akamai system error (5xx):
    - PagerDuty alert if purge infrastructure is down
    - Queued jobs wait (BullMQ delayed retry)
    - Content may be stale: notify editors via admin console banner
    
  Idempotency:
    - Purging same tag twice: safe (Akamai is idempotent)
    - Duplicate jobs in queue: deduplicate by tag set fingerprint (SHA256 of sorted tags)
```

---

## Purge Audit and Reporting

```
purge_log table entries are searchable in admin console:
  - Filter by: date range, trigger type, status, scope, entity
  - Shows: purge ID, tags purged, latency, status
  
Grafana panel: Purge Activity
  - Purges per hour (bar chart)
  - P95 purge completion time (gauge)
  - Failed purge rate (counter)
  - Purge latency heatmap (by trigger type)
  
Daily digest:
  - Total purges
  - Average latency
  - Failures (with links to retry)
  - Top purge triggers (by entity type)
  - Sent to #operations-alerts Slack channel at 9am
```

---

## Surrogate-Control Header Implementation (NestJS)

```typescript
// packages/shared-types/src/cache.headers.ts

interface CacheOptions {
  maxAge: number;          // edge TTL in seconds
  browserMaxAge?: number;  // browser TTL (default: 0/no-cache)
  surrogateKeys: string[]; // cache tags
  staleWhileRevalidate?: number;
  staleIfError?: number;
}

export function setCacheHeaders(res: Response, options: CacheOptions): void {
  const tags = options.surrogateKeys.join(' ');
  
  res.setHeader('Surrogate-Control', 
    `max-age=${options.maxAge}` + 
    (options.staleWhileRevalidate ? `, stale-while-revalidate=${options.staleWhileRevalidate}` : '') +
    (options.staleIfError ? `, stale-if-error=${options.staleIfError}` : '')
  );
  
  res.setHeader('Surrogate-Key', tags);
  
  const browserTTL = options.browserMaxAge ?? 0;
  res.setHeader('Cache-Control', 
    browserTTL > 0 
      ? `public, max-age=${browserTTL}` 
      : 'public, no-cache, must-revalidate'
  );
}

// Usage in NestJS controller:
@Get(':slug')
async getArticle(@Param('slug') slug: string, @Res() res: Response) {
  const article = await this.contentService.getPublished('article', slug);
  const tags = generateCacheTags(article.entry, article.version);
  
  setCacheHeaders(res, {
    maxAge: 300,
    surrogateKeys: tags,
    staleIfError: 3600,   // serve stale for 1h if origin fails
  });
  
  return res.json(article.version.fields);
}
```
