# Reporting and Observability

## Observability Stack Architecture

```
Application Layer
  ├── OpenTelemetry SDK (cms-api, web-frontend, workers)
  │     ├── Traces   → OTel Collector → Jaeger (or Tempo)
  │     ├── Metrics  → OTel Collector → Prometheus
  │     └── Logs     → OTel Collector → OpenSearch (structured JSON)
  │
  └── Runtime metrics (Node.js, PostgreSQL, Redis)
        └── Prometheus exporters → Prometheus

Edge Layer (Akamai)
  ├── DataStream 2 → S3 → Fluent Bit → OpenSearch (edge access logs)
  └── Akamai Control Center metrics (manual / API polling for aggregate metrics)

Infrastructure Layer
  ├── node_exporter (host metrics)
  ├── postgres_exporter
  ├── redis_exporter
  └── All → Prometheus

Visualization & Alerting
  ├── Grafana (dashboards for all data sources)
  ├── Prometheus Alertmanager → PagerDuty / Slack
  └── OpenSearch Dashboards (log exploration, Akamai edge log analytics)
```

---

## DataStream 2 Log Pipeline

### S3 → OpenSearch Pipeline

```yaml
# fluent-bit configuration for DataStream 2 log ingestion
[INPUT]
    Name              s3
    bucket            akamai-logs-prod-raw
    region            us-east-1
    prefix            datastream/
    polling_interval  30
    
[FILTER]
    Name              parser
    Match             akamai.*
    Key_Name          log
    Parser            akamai_json
    Reserve_Data      On

[FILTER]
    Name              record_modifier
    Match             akamai.*
    Record            env production
    Record            source akamai-edge

[FILTER]
    Name              geoip2  # MaxMind GeoIP for IP enrichment
    Match             akamai.*
    Database          /etc/GeoLite2-City.mmdb
    Lookup_Key        client_ip
    Record            geo_country  ${ip.country.iso_code}
    Record            geo_city     ${ip.city.name}

[OUTPUT]
    Name              opensearch
    Match             akamai.*
    Host              opensearch.internal.example.com
    Port              443
    TLS               On
    Index             akamai-access
    Type              _doc
    Logstash_Format   On        # creates daily indices: akamai-access-YYYY.MM.DD
    Logstash_Prefix   akamai-access
    Buffer_Size       5MB
    Retry_Limit       5
```

### OpenSearch Index Template

```json
{
  "index_patterns": ["akamai-access-*"],
  "template": {
    "settings": {
      "number_of_shards": 2,
      "number_of_replicas": 1,
      "index.lifecycle.name": "akamai-logs-ilm",
      "index.lifecycle.rollover_alias": "akamai-access"
    },
    "mappings": {
      "properties": {
        "@timestamp":       {"type": "date"},
        "client_ip":        {"type": "ip"},
        "method":           {"type": "keyword"},
        "url":              {"type": "keyword", "ignore_above": 2048},
        "path":             {"type": "keyword"},
        "status_code":      {"type": "short"},
        "bytes_sent":       {"type": "long"},
        "cache_status":     {"type": "keyword"},
        "response_time_ms": {"type": "float"},
        "cp_code":          {"type": "keyword"},
        "country_code":     {"type": "keyword"},
        "waf_action":       {"type": "keyword"},
        "bot_score":        {"type": "float"},
        "edge_ip":          {"type": "ip"},
        "arl":              {"type": "keyword"},
        "user_agent":       {"type": "text", "fields": {"raw": {"type": "keyword"}}},
        "referer":          {"type": "keyword"},
        "geo_country":      {"type": "keyword"},
        "geo_city":         {"type": "keyword"}
      }
    }
  }
}
```

### Index Lifecycle Management (ILM)

```json
{
  "policy": {
    "phases": {
      "hot":    {"min_age": "0ms",  "actions": {"rollover": {"max_size": "50gb", "max_age": "1d"}}},
      "warm":   {"min_age": "3d",   "actions": {"shrink": {"number_of_shards": 1}, "forcemerge": {"max_num_segments": 1}}},
      "cold":   {"min_age": "30d",  "actions": {"freeze": {}}},
      "delete": {"min_age": "90d",  "actions": {"delete": {}}}
    }
  }
}
```

---

## Prometheus Metrics

### Key Metrics Collected

```
# CMS API metrics (via OpenTelemetry / prom-client)
http_requests_total{method, path, status}                # request count
http_request_duration_seconds{method, path, status}      # latency histogram
cms_publish_total{site_id, content_type, status}         # publish events
cms_purge_duration_seconds{type, scope, status}          # purge latency
cms_purge_tags_total{status}                             # tags purged
cms_preview_tokens_active                                # active preview tokens
cms_upload_total{mime_type, status}                      # upload events
cms_webhook_delivery_total{status}                       # webhook delivery
cms_search_index_duration_seconds{type}                  # search index latency

# PostgreSQL metrics (postgres_exporter)
pg_stat_activity_count{state}                            # active queries
pg_stat_replication_lag_bytes                            # replication lag
pg_database_size_bytes                                   # DB size
pg_locks_count{mode}                                     # lock contention
pg_stat_user_tables_n_tup_ins{table}                     # insert rate

# Redis metrics (redis_exporter)
redis_memory_used_bytes                                  # memory usage
redis_connected_clients                                  # active connections
redis_commands_total{cmd}                                # command throughput
redis_keyspace_hits_total / redis_keyspace_misses_total  # cache hit ratio
redis_replication_lag_bytes                              # replication lag

# Queue metrics (BullMQ dashboard or custom)
bullmq_queue_waiting{queue_name}                         # jobs waiting
bullmq_queue_active{queue_name}                          # jobs processing
bullmq_queue_failed{queue_name}                          # failed jobs
bullmq_queue_completed{queue_name}                       # completed jobs

# Akamai aggregate metrics (polled from Akamai Reporting API, if available)
akamai_edge_hits_total{cp_code}                         # edge hit count
akamai_origin_hits_total{cp_code}                       # origin hit count (cache misses)
akamai_cache_hit_ratio{cp_code}                         # CHR per CP code
akamai_bytes_delivered_total{cp_code}                   # bandwidth
akamai_error_rate{cp_code, status_code}                 # error rates
```

---

## Alerting Rules

### Prometheus Alerting Rules

```yaml
groups:
  - name: cms-api
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) /
          sum(rate(http_requests_total[5m])) > 0.05
        for: 2m
        labels: { severity: critical }
        annotations:
          summary: "CMS API error rate > 5%"
          
      - alert: SlowPublishPipeline
        expr: cms_publish_duration_seconds{quantile="0.95"} > 30
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "95th percentile publish latency > 30s"
          
      - alert: PurgeWorkerBacklog
        expr: bullmq_queue_waiting{queue_name="purge"} > 100
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "Purge queue backlog > 100 jobs"
          
      - alert: PublishWorkerDown
        expr: absent(bullmq_queue_active{queue_name="publish"})
        for: 3m
        labels: { severity: critical }
        annotations:
          summary: "Publish worker not processing jobs"
          
      - alert: DatabaseReplicationLag
        expr: pg_stat_replication_lag_bytes > 104857600
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "PostgreSQL replication lag > 100MB"
          
      - alert: RedisMemoryHigh
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.85
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "Redis memory usage > 85%"

  - name: akamai-edge
    rules:
      - alert: LowCacheHitRatio
        expr: akamai_cache_hit_ratio{cp_code="WEB-DYNAMIC-PROD"} < 0.70
        for: 10m
        labels: { severity: warning }
        annotations:
          summary: "Dynamic page cache hit ratio < 70%"
          
      - alert: HighEdgeErrorRate
        expr: |
          sum(rate(akamai_error_rate{status_code=~"5.."}[5m])) > 0.02
        for: 3m
        labels: { severity: critical }
        annotations:
          summary: "Akamai edge error rate > 2%"
```

---

## Grafana Dashboard Designs

### Dashboard 1: Operations (DevOps/Platform Team)

```
Row 1: System Health
  - CMS API error rate (gauge + sparkline)
  - P95 API latency (gauge)
  - DB connections active (gauge)
  - Redis memory % (gauge)

Row 2: CDN Performance
  - Cache hit ratio by CP code (stacked bar, 24h)
  - Origin offload % (gauge)
  - Edge bytes delivered (total counter)
  - Origin error rate (line graph)

Row 3: Publishing Pipeline
  - Publishes/hour (bar chart)
  - Purge queue depth (line)
  - Purge latency P95 (gauge)
  - Failed publish jobs (counter + alert)

Row 4: Infrastructure
  - PostgreSQL: query latency, active connections, replication lag
  - Redis: memory, hit ratio, connected clients
  - K8s pod health (pod status table)
```

### Dashboard 2: Security (Security Team)

```
Row 1: WAF Summary
  - WAF blocks/hour (bar chart, 24h)
  - WAF blocks by rule type (pie)
  - Top attacking IPs (table, 1h window)
  - Country of attack origin (map)

Row 2: Bot Activity
  - Bot score distribution (histogram)
  - Bot challenge outcomes (accept/reject/bypass)
  - Bot traffic % of total

Row 3: Auth Events
  - Login attempts (total, success, failure)
  - Failed login rate by IP (table)
  - MFA challenge rate
  - Active admin sessions

Row 4: Upload Security
  - Upload attempts (total)
  - Malware detections (counter + alert)
  - Rejected file types (table)
```

### Dashboard 3: Editorial (Content Team)

```
Row 1: Publishing Activity
  - Publishes today (counter)
  - Scheduled upcoming publishes (table)
  - Publish failures (counter + alert)
  - Average publish-to-live latency (gauge)

Row 2: Content Inventory
  - Content by type and status (stacked bar)
  - Drafts pending review (counter)
  - Content by site (table)

Row 3: Traffic (Simple)
  - Top content by page views (table, last 24h)
  - Unique visitors today (counter)
  - Search queries (top terms, last 7d)

Row 4: Purge Activity
  - Purges today (counter)
  - Average purge completion time (gauge)
  - Purge failures (counter)
```

### Dashboard 4: Business (Management)

```
Row 1: Traffic KPIs
  - Monthly active users (gauge)
  - Page views/day (line, 30d)
  - Bandwidth served (total, by region)
  - Top countries (map)

Row 2: Content KPIs
  - Published content count (by type)
  - Publishing velocity (publishes/week)
  - Content freshness (% updated in last 30d)

Row 3: Performance SLOs
  - Availability % (30d rolling)
  - P95 page load time (vs target)
  - Cache hit ratio (vs target)

Row 4: Streaming (if applicable)
  - Stream starts today
  - Peak concurrent viewers
  - Average watch time
  - Rebuffer ratio
```

---

## Streaming Metrics

```
VOD Metrics (from AMD DataStream):
  manifest_requests_total{video_id}         # HLS master requests
  segment_requests_total{video_id}          # segment requests
  segment_cache_hits{video_id}              # cache hit ratio for segments
  stream_bandwidth_bytes{video_id}          # total bytes for stream
  token_validation_failures{video_id}       # token auth failures
  geo_blocked_requests{video_id, country}   # geo restriction events

Viewer-side metrics (via CMS video player analytics):
  video_starts_total
  video_completions_total
  video_errors_total{error_type}
  buffer_events_total{video_id}
  startup_time_seconds{video_id, p50, p95}
  rebuffer_duration_seconds{video_id}
  
Reported to: OpenSearch (server-side) + Grafana (dashboard)
```

---

## Real-User Monitoring (RUM)

```
Implementation: Akamai mPulse [ENTITLEMENT] OR web-vitals library (free)

Web Vitals measured:
  - LCP (Largest Contentful Paint): target < 2.5s
  - CLS (Cumulative Layout Shift): target < 0.1
  - FID/INP (Interaction to Next Paint): target < 200ms
  - TTFB (Time to First Byte): target < 800ms (from user perspective)
  - FCP (First Contentful Paint): target < 1.8s

Collection:
  JavaScript snippet in Next.js _app.js or layout.tsx:
  ```javascript
  import { getCLS, getLCP, getFID, getTTFB } from 'web-vitals';
  
  function sendToAnalytics(metric) {
    fetch('/api/v1/rum', {
      method: 'POST',
      body: JSON.stringify(metric),
      keepalive: true
    });
  }
  
  getCLS(sendToAnalytics);
  getLCP(sendToAnalytics);
  getFID(sendToAnalytics);
  getTTFB(sendToAnalytics);
  ```
  
RUM endpoint (/api/v1/rum):
  - Receives metrics, associates with page URL and session
  - No PII (no IP stored, no user ID unless logged in)
  - Batched writes to OpenSearch
  - Visualized in Grafana (Web Vitals by page, percentile distribution)
```

---

## SLO Definitions and Alerting Thresholds

```
SLO 1: Public Website Availability
  Target: 99.9% (8.7 hours downtime/year)
  Measurement: Synthetic probe every 60s from 5 global regions
  Alert: < 99.5% over 5-minute window → PagerDuty P1

SLO 2: Page TTFB (Edge-cached)
  Target: P95 < 200ms
  Alert: P95 > 500ms for 5 minutes → Slack warning

SLO 3: API Response Time
  Target: P95 < 500ms
  Alert: P95 > 1000ms for 5 minutes → PagerDuty P2

SLO 4: Publish-to-Live Latency
  Target: 95% of publishes complete purge within 30 seconds
  Alert: > 60s for any publish → Slack warning

SLO 5: Cache Hit Ratio
  Static: Target > 95%, Alert < 90%
  Dynamic: Target > 75%, Alert < 60%

SLO 6: Video Stream Startup Time
  Target: P95 < 3 seconds
  Alert: P95 > 5 seconds → PagerDuty P2

SLO 7: Video Rebuffer Ratio
  Target: < 0.5%
  Alert: > 2% → Slack warning

SLO 8: CMS Admin API Availability
  Target: 99.5% during business hours (8am-8pm)
  Alert: < 99% over 10-minute window → PagerDuty P1
```
