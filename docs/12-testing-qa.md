# Testing and QA Plan

## Testing Pyramid

```
                        /\
                       /  \
                      / E2E \          ← Few, high-value, slow
                     /  Tests \
                    /──────────\
                   /  Integration\     ← Some, service-boundary tests
                  /     Tests     \
                 /──────────────────\
                /    Unit Tests      \  ← Many, fast, isolated
               /──────────────────────\
              /   Static Analysis /     \
             /   Type Check / Lint       \
            /────────────────────────────\
```

---

## Unit Tests

### CMS API Unit Tests (Jest + NestJS Testing)

```typescript
// apps/cms-api/src/content/content.service.spec.ts

describe('ContentService', () => {
  describe('publish()', () => {
    it('transitions status from in_review to published', async () => { ... });
    it('throws if status is draft (requires review first)', async () => { ... });
    it('assigns published_at timestamp', async () => { ... });
    it('increments version number', async () => { ... });
    it('creates publish_jobs queue entry', async () => { ... });
    it('writes audit log', async () => { ... });
  });
  
  describe('rollback()', () => {
    it('copies target version fields to new version', async () => { ... });
    it('throws on invalid version number', async () => { ... });
    it('triggers purge job', async () => { ... });
  });
  
  describe('generateCacheTags()', () => {
    it('includes entity tag', async () => { ... });
    it('includes listing tag', async () => { ... });
    it('includes referenced author tag', async () => { ... });
    it('deduplicates tags', async () => { ... });
  });
});

// packages/akamai-client/src/fast-purge.client.spec.ts
describe('AkamaiPurgeClient', () => {
  it('sends invalidation request with correct path', async () => { ... });
  it('retries on 429 rate limit', async () => { ... });
  it('rejects on non-201 response', async () => { ... });
  it('batches objects exceeding 1000 limit', async () => { ... });
});
```

**Coverage targets:** 80% statement coverage minimum, 90% for purge and auth modules.

---

## Integration Tests

### API Integration Tests (Supertest + real PostgreSQL + Redis)

```typescript
// apps/cms-api/test/integration/content.integration.spec.ts

describe('Content API Integration', () => {
  beforeAll(async () => {
    // Use test database (real PG instance via Docker Compose)
    await db.migrate.latest();
    await db.seed.run();
  });
  
  describe('POST /api/v1/admin/content/article (create)', () => {
    it('creates draft entry with correct fields', async () => {
      const res = await request(app)
        .post('/api/v1/admin/content/article')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({siteId, locale: 'en', fields: {title: 'Test', body: '<p>Hello</p>'}})
        .expect(201);
      
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.version).toBe(1);
    });
    
    it('rejects editor creating with publisher permission check', async () => {
      // Editor cannot publish directly
      await request(app)
        .post(`/api/v1/admin/content/article/${articleId}/publish`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(403);
    });
    
    it('publisher can publish draft', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/content/article/${articleId}/publish`)
        .set('Authorization', `Bearer ${publisherToken}`)
        .expect(202);
      
      expect(res.body.data.jobId).toBeDefined();
    });
  });
  
  describe('Cache header integration', () => {
    it('GET /api/v1/content/article/{slug} returns Surrogate-Control header', async () => {
      const res = await request(app)
        .get(`/api/v1/content/article/test-article`)
        .expect(200);
      
      expect(res.headers['surrogate-control']).toMatch(/max-age=\d+/);
      expect(res.headers['surrogate-key']).toContain('article:');
    });
    
    it('admin endpoints do NOT return cacheable headers', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/content/article/${id}`)
        .set('Authorization', `Bearer ${publisherToken}`)
        .expect(200);
      
      expect(res.headers['surrogate-control']).toBeUndefined();
      expect(res.headers['cache-control']).toMatch(/no-store|private/);
    });
  });
});
```

---

## Akamai Staging Tests

```bash
#!/usr/bin/env bash
# tests/akamai/validate-cache-headers.sh
# Uses curl with DNS override to hit Akamai staging network

STAGING_HOST="www.example.com"
STAGING_EDGE="www.example.com.edgesuite-staging.net"

# Resolve staging edge hostname to IP
STAGING_IP=$(dig +short "$STAGING_EDGE" | head -1)

# Test 1: Static asset caches at edge
echo "=== Test: Static asset caching ==="
RESP1=$(curl -si --connect-to "$STAGING_HOST:443:$STAGING_IP:443" \
  "https://$STAGING_HOST/_next/static/app-abc123.js" -o /dev/null)

RESP2=$(curl -si --connect-to "$STAGING_HOST:443:$STAGING_IP:443" \
  "https://$STAGING_HOST/_next/static/app-abc123.js" -o /dev/null)

CACHE_STATUS=$(echo "$RESP2" | grep -i "x-check-cacheable\|x-cache" | awk '{print $2}')
if [[ "$CACHE_STATUS" == *"YES"* ]] || [[ "$RESP2" == *"TCP_HIT"* ]]; then
  echo "PASS: Static asset cached at edge"
else
  echo "FAIL: Static asset not cached. Headers: $CACHE_STATUS"
  exit 1
fi

# Test 2: Security headers present
echo "=== Test: Security headers ==="
HEADERS=$(curl -si --connect-to "$STAGING_HOST:443:$STAGING_IP:443" \
  "https://$STAGING_HOST/" | head -50)

check_header() {
  local name="$1" value="$2"
  if echo "$HEADERS" | grep -qi "$value"; then
    echo "PASS: $name header present"
  else
    echo "FAIL: $name header missing. Expected: $value"
    exit 1
  fi
}

check_header "HSTS" "strict-transport-security"
check_header "X-Frame-Options" "x-frame-options"
check_header "X-Content-Type-Options" "nosniff"
check_header "Referrer-Policy" "referrer-policy"

# Test 3: HTTP → HTTPS redirect
echo "=== Test: HTTP redirect ==="
REDIRECT=$(curl -si "http://$STAGING_HOST/" --connect-to "$STAGING_HOST:80:$STAGING_IP:80" | head -5)
if echo "$REDIRECT" | grep -q "301\|302"; then
  echo "PASS: HTTP redirects to HTTPS"
else
  echo "FAIL: HTTP redirect not working"
  exit 1
fi

# Test 4: Admin path blocked at edge
echo "=== Test: Admin path blocked ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --connect-to "$STAGING_HOST:443:$STAGING_IP:443" \
  "https://$STAGING_HOST/api/v1/admin/users")
if [[ "$STATUS" == "403" ]]; then
  echo "PASS: Admin path returns 403"
else
  echo "FAIL: Admin path returned $STATUS (expected 403)"
  exit 1
fi

echo "=== All Akamai staging tests passed ==="
```

### Cache Behavior Test (Node.js)

```typescript
// tests/akamai/cache-behavior.test.ts

describe('Akamai Cache Behaviors', () => {
  const client = new AkamaiStagingClient(process.env.STAGING_IP!);
  
  test('Dynamic page caches with surrogate key', async () => {
    const res1 = await client.get('/articles/test-article');
    expect(res1.headers['surrogate-key']).toContain('article:');
    
    // Second request should be cache hit
    const res2 = await client.get('/articles/test-article');
    expect(res2.headers['x-check-cacheable'] ?? res2.headers['x-cache'])
      .toMatch(/YES|HIT/i);
  });
  
  test('Purge invalidates cached content', async () => {
    // Cache the page
    await client.get('/articles/test-article');
    
    // Purge by tag
    await purgeClient.invalidate({ scope: 'tag', objects: ['article:test-123'] });
    
    // Wait for purge
    await new Promise(r => setTimeout(r, 10_000));
    
    // Next request should be cache miss
    const res = await client.get('/articles/test-article');
    expect(res.headers['x-check-cacheable'] ?? res.headers['x-cache'])
      .toMatch(/NO|MISS/i);
  });
  
  test('Authenticated request not cached', async () => {
    const res = await client.get('/articles/test-article', {
      headers: { Cookie: 'session=fake-session-token' }
    });
    expect(res.headers['cache-control']).toMatch(/no-store|private/i);
  });
  
  test('Preview request not cached', async () => {
    const res = await client.get('/preview/articles/test-article', {
      headers: { 'X-Preview-Token': 'test-token' }
    });
    expect(res.headers['cache-control']).toMatch(/no-store/i);
  });
  
  test('Image derivative cached with correct TTL', async () => {
    const res = await client.get('/images/test-image.jpg?w=800&q=80');
    const age = parseInt(res.headers['cache-control'].match(/max-age=(\d+)/)?.[1] ?? '0');
    expect(age).toBeGreaterThan(86400);  // > 1 day
  });
});
```

---

## Load Tests (k6)

```javascript
// tests/load/publishing-pipeline.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const publishLatency = new Trend('publish_latency');
const purgeLatency = new Trend('purge_latency');
const publishErrors = new Counter('publish_errors');

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // ramp up to 10 users
    { duration: '5m', target: 50 },   // sustain 50 concurrent publishers
    { duration: '2m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p95<500'],    // 95% of requests < 500ms
    publish_latency: ['p95<30000'],    // 95% of publishes < 30s end-to-end
    publish_errors: ['count<5'],
  },
};

export default function () {
  const BASE = 'https://api.staging.example.com';
  const headers = { Authorization: `Bearer ${__ENV.PUBLISHER_TOKEN}` };
  
  // Create article
  const createRes = http.post(`${BASE}/api/v1/admin/content/article`,
    JSON.stringify({siteId: __ENV.SITE_ID, locale: 'en', fields: {title: `Load Test ${Date.now()}`}}),
    { headers: { ...headers, 'Content-Type': 'application/json' } }
  );
  check(createRes, { 'created 201': r => r.status === 201 });
  
  const articleId = createRes.json('data.id');
  const start = Date.now();
  
  // Publish
  const pubRes = http.post(`${BASE}/api/v1/admin/content/article/${articleId}/publish`,
    null, { headers });
  check(pubRes, { 'publish 202': r => r.status === 202 });
  
  if (pubRes.status !== 202) {
    publishErrors.add(1);
    return;
  }
  
  const jobId = pubRes.json('data.jobId');
  
  // Poll for purge completion
  let purgeComplete = false;
  for (let i = 0; i < 15; i++) {
    sleep(2);
    const statusRes = http.get(`${BASE}/api/v1/admin/purge/${jobId}`, { headers });
    if (statusRes.json('data.status') === 'complete') {
      purgeComplete = true;
      const totalLatency = Date.now() - start;
      publishLatency.add(totalLatency);
      purgeLatency.add(statusRes.json('data.latencyMs'));
      break;
    }
  }
  
  if (!purgeComplete) publishErrors.add(1);
}
```

---

## Security Tests (Staging Only)

### OWASP ZAP Automation

```yaml
# tests/security/zap-config.yaml

env:
  contexts:
    - name: CMS Platform
      urls: ["https://staging.example.com"]
      excludePaths:
        - ".*\\.pdf"
        - "/api/v1/admin/purge.*"   # avoid triggering purges
        - "/api/v1/auth/logout"
  
  parameters:
    maxRuleDurationInMins: 5
    maxScanDurationInMins: 240  # 4 hour total limit
    strength: medium
    threshold: medium

jobs:
  - type: spider
    parameters:
      context: CMS Platform
      maxDuration: 15
      maxDepth: 5
      maxChildren: 100
      
  - type: activeScan
    parameters:
      context: CMS Platform
      maxRuleDurationInMins: 3
      strength: medium
      
  - type: report
    parameters:
      reportDir: /reports
      reportTitle: CMS Security Report
      reportFile: zap-report
      reportDescription: OWASP ZAP Scan Results
      template: traditional-html

  - type: outputSummary
    parameters:
      summaryFile: /reports/summary.json

# Run via:
# docker run --rm -v $(pwd)/reports:/reports \
#   ghcr.io/zaproxy/zaproxy:stable zap-automation.sh -autorun zap-config.yaml
```

---

## CMS Workflow Tests (Playwright)

```typescript
// tests/e2e/publishing-workflow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Publishing Workflow', () => {
  test('editor creates draft and publisher publishes', async ({ page, context }) => {
    // Editor login
    const editorPage = await context.newPage();
    await editorPage.goto('/admin');
    await editorPage.fill('[data-testid=email]', 'editor@example.com');
    await editorPage.fill('[data-testid=password]', process.env.EDITOR_PASSWORD!);
    await editorPage.click('[data-testid=login-btn]');
    
    // Create article
    await editorPage.click('[href="/content/article/new"]');
    await editorPage.fill('[data-testid=field-title]', 'E2E Test Article');
    await editorPage.fill('[data-testid=field-body]', 'Test body content');
    await editorPage.click('[data-testid=save-draft]');
    await expect(editorPage.locator('[data-testid=status-badge]')).toHaveText('Draft');
    
    const articleId = await editorPage.url().match(/\/(\w+-\w+-\w+)$/)?.[1];
    
    // Submit for review
    await editorPage.click('[data-testid=submit-review]');
    await expect(editorPage.locator('[data-testid=status-badge]')).toHaveText('In Review');
    
    // Publisher approves and publishes
    const publisherPage = await context.newPage();
    await loginAs(publisherPage, 'publisher@example.com');
    await publisherPage.goto(`/admin/content/article/${articleId}`);
    
    await publisherPage.click('[data-testid=approve-btn]');
    await publisherPage.click('[data-testid=publish-btn]');
    await publisherPage.click('[data-testid=confirm-publish]');
    
    await expect(publisherPage.locator('[data-testid=status-badge]')).toHaveText('Published');
    
    // Verify content is live (check public URL)
    await page.goto('/articles/e2e-test-article');
    await expect(page.locator('h1')).toHaveText('E2E Test Article');
    
    // Verify cache headers
    const response = await page.request.get('/articles/e2e-test-article');
    expect(response.headers()['surrogate-control']).toContain('max-age=');
  });
  
  test('rollback reverts to previous version', async ({ page }) => { ... });
  test('scheduled publish fires at correct time', async ({ page }) => { ... });
  test('preview link shows draft content', async ({ page }) => { ... });
});
```

---

## SEO Tests

```typescript
// tests/e2e/seo.spec.ts

test.describe('SEO Requirements', () => {
  test('article page has correct meta tags', async ({ page }) => {
    await page.goto('/articles/my-article');
    
    const title = await page.title();
    expect(title).toMatch(/My Article Title/);
    
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length).toBeGreaterThan(50);
    expect(description?.length).toBeLessThan(160);
    
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe('https://www.example.com/articles/my-article');
    
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();
    
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toMatch(/^https:/);
  });
  
  test('sitemap.xml is accessible and valid', async ({ page }) => {
    const response = await page.request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('xml');
    
    const body = await response.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('<loc>');
  });
  
  test('robots.txt disallows admin paths', async ({ page }) => {
    const response = await page.request.get('/robots.txt');
    const body = await response.text();
    expect(body).toContain('Disallow: /api/v1/admin');
    expect(body).toContain('Sitemap: https://www.example.com/sitemap.xml');
  });
  
  test('structured data present on article', async ({ page }) => {
    await page.goto('/articles/my-article');
    const schema = await page.locator('script[type="application/ld+json"]').textContent();
    const parsed = JSON.parse(schema!);
    expect(parsed['@type']).toBe('Article');
    expect(parsed.headline).toBeTruthy();
  });
});
```

---

## Accessibility Tests

```typescript
// tests/e2e/accessibility.spec.ts

import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility', () => {
  test('homepage passes axe core', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);
    await checkA11y(page, null, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  });
  
  test('article page passes axe core', async ({ page }) => {
    await page.goto('/articles/test-article');
    await injectAxe(page);
    await checkA11y(page);
  });
  
  test('admin console login is keyboard navigable', async ({ page }) => {
    await page.goto('/admin/login');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focused).toBe('email');
  });
});
```

---

## Performance Targets (Test Assertions)

```typescript
// tests/performance/web-vitals.spec.ts

test('LCP < 2.5s on article page', async ({ page }) => {
  await page.goto('/articles/test-article');
  const lcp = await page.evaluate(() => {
    return new Promise(resolve => {
      new PerformanceObserver(list => {
        const entries = list.getEntries();
        resolve(entries[entries.length - 1].startTime);
      }).observe({ entryTypes: ['largest-contentful-paint'] });
    });
  });
  expect(lcp).toBeLessThan(2500);
});

test('Static asset TTFB < 100ms (edge cached)', async ({ page }) => {
  // Warm cache first
  await page.request.get('https://cdn.example.com/images/test.jpg');
  
  const timing = await page.evaluate(async () => {
    const start = performance.now();
    await fetch('https://cdn.example.com/images/test.jpg');
    return performance.now() - start;
  });
  
  expect(timing).toBeLessThan(100);
});
```

---

## Test Coverage Requirements

| Layer | Tool | Minimum Coverage | Gate |
|---|---|---|---|
| Unit tests | Jest | 80% statements, 90% for auth/purge | CI fail below threshold |
| Integration tests | Supertest | All API endpoints covered | CI fail on missing endpoint |
| E2E tests | Playwright | Core workflows: create/publish/preview/rollback | CI fail on failure |
| Akamai staging tests | curl + node | Cache, headers, redirects, WAF, purge | CI fail on failure |
| Load tests | k6 | P95 latency < 500ms at 50 concurrent users | Nightly CI job |
| Security tests | OWASP ZAP | Zero HIGH/CRITICAL findings | Weekly staging scan; blocks prod if violated |
| Accessibility | axe-playwright | Zero WCAG 2.1 AA violations on key pages | CI warning (block on critical) |
| SEO | Playwright | Meta tags, sitemap, robots, structured data | CI fail on missing required tags |
