# Performance Targets

## Delivery Performance

| Metric | Target | Alert Threshold | Measurement |
|---|---|---|---|
| Static asset TTFB (edge cached) | < 50ms P95 | > 100ms | Synthetic probe from 5 regions |
| Static asset cache hit ratio | > 95% | < 90% | DataStream 2 TCP_HIT / total |
| Dynamic page TTFB (edge cached) | < 200ms P95 | > 500ms | Synthetic probe |
| Dynamic page cache hit ratio | > 75% | < 60% | DataStream 2 |
| API response time (cached) | < 150ms P95 | > 300ms | Synthetic probe |
| API response time (origin) | < 300ms P95 | > 600ms | Prometheus http_request_duration |
| Origin offload (static) | > 97% | < 95% | 1 - (origin_hits / total_hits) |
| Origin offload (dynamic) | > 85% | < 75% | DataStream 2 per CP code |

## Web Vitals (Real Users)

| Metric | Target (Good) | Target (Needs Improvement) | Measurement |
|---|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | < 4.0s | RUM (web-vitals) |
| CLS (Cumulative Layout Shift) | < 0.1 | < 0.25 | RUM |
| INP (Interaction to Next Paint) | < 200ms | < 500ms | RUM |
| FCP (First Contentful Paint) | < 1.8s | < 3.0s | RUM |
| TTFB (Time to First Byte, user) | < 800ms | < 1800ms | RUM |

## CMS Editorial Pipeline

| Metric | Target | Alert Threshold | Measurement |
|---|---|---|---|
| Publish-to-live latency (purge completion) | < 30s P95 | > 60s | purge_log.latency_ms |
| Publishing success rate | > 99.5% | < 99% | bullmq_queue_failed / total |
| Search re-index latency | < 60s P95 | > 120s | search_worker event timing |
| Webhook delivery success rate | > 99% | < 97% | webhook_delivery_total by status |
| Webhook delivery latency | < 5s P95 | > 15s | webhook_delivery event timing |
| Admin API response time | < 500ms P95 | > 1000ms | Prometheus |
| Preview page load time | < 3s | > 5s | Synthetic probe |

## Akamai Fast Purge

| Metric | Target | Alert Threshold | Measurement |
|---|---|---|---|
| Tag purge completion | < 10s P95 | > 30s | purge_log.latency_ms |
| URL purge completion | < 10s P95 | > 30s | purge_log.latency_ms |
| Purge success rate | > 99.9% | < 99% | purge_log.status = failed |
| Max purge queue depth | < 50 jobs | > 100 jobs | bullmq_queue_waiting |

## Streaming (VOD)

| Metric | Target | Alert Threshold | Measurement |
|---|---|---|---|
| Stream startup time (TTFF) | < 3s P95 | > 5s | Player analytics |
| Rebuffer ratio | < 0.5% | > 2% | Player analytics |
| Segment cache hit ratio | > 85% | < 70% | DataStream 2 (AMD CP code) |
| Token validation latency | < 50ms P95 | > 100ms | EdgeWorker timing |
| Stream error rate | < 0.1% | > 1% | DataStream 2 5xx |

## Availability and Reliability

| Metric | Target | Alert Threshold | Measurement |
|---|---|---|---|
| Public website availability | 99.9% monthly | < 99.5% over 5 min | Synthetic probe (5 regions) |
| CMS admin availability | 99.5% business hours | < 99% over 10 min | Synthetic probe |
| CMS API availability | 99.9% | < 99.5% over 5 min | Prometheus + synthetic |
| Akamai edge error rate | < 0.5% | > 2% | DataStream 2 5xx / total |
| Origin error rate | < 0.1% | > 1% | DataStream 2 origin_5xx |
| Database availability | 99.99% | < 99.9% | RDS CloudWatch + app probe |

## Upload and Media Processing

| Metric | Target | Alert Threshold | Measurement |
|---|---|---|---|
| Presigned URL generation | < 100ms | > 500ms | Prometheus |
| Malware scan completion | < 60s | > 120s | Upload worker timing |
| Image thumbnail generation | < 10s | > 30s | Upload worker timing |
| Video transcoding (1080p, 10min video) | < 30min | > 60min | Transcoding job timing |
| S3 upload throughput | > 100MB/s | < 50MB/s | S3 metrics |

## Infrastructure Resource Utilization

| Resource | Target | Alert Threshold |
|---|---|---|
| CMS API pod CPU | < 70% avg | > 85% |
| CMS API pod memory | < 80% | > 90% |
| PostgreSQL connections (PgBouncer) | < 80% pool | > 90% pool |
| PostgreSQL query P95 latency | < 50ms | > 200ms |
| Redis memory | < 75% max | > 85% max |
| Redis CPU | < 50% | > 80% |
| S3 request rate | within limits | approaching limits |

## Cost Efficiency Targets

| Metric | Target | Measurement |
|---|---|---|
| Akamai bandwidth offload | > 95% (origin bandwidth cost minimized) | DataStream 2 bytes |
| S3 origin requests | < 5% of total requests | DataStream 2 origin_hits |
| Redis cache hit ratio (application cache) | > 80% | redis_keyspace_hits / total |
| Media storage growth | < 1TB/month (until defined) | S3 bucket size |

## Baseline Measurement Strategy

```
Phase 1 (no CDN yet): Establish baseline
  - Record raw origin response times
  - Record DB query latencies
  - Record upload processing times
  
Phase 2 (CDN live): Establish CDN baseline
  - Record initial cache hit ratios (expect low initially)
  - Record purge latencies
  - Record first TTFB measurements from edge
  
After 2 weeks: Compare against targets
  - Identify gaps
  - Tune TTLs, caching rules, origin performance
  - Re-measure weekly

Measurement tools:
  - Synthetic: Grafana k6 Cloud (or Checkly) probing from 5+ regions
  - Real-user: web-vitals.js sending to /api/v1/rum
  - Infrastructure: Prometheus + Grafana
  - Edge: DataStream 2 → OpenSearch queries
  - Purge: purge_log table queries
```
