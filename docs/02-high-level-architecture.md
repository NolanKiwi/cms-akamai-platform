# High-Level Architecture

## System Context Diagram

```mermaid
graph TB
    subgraph Users["End Users & Clients"]
        Browser["Browser / Mobile"]
        VideoPlayer["Video Player (HLS/DASH)"]
        Partner["Partner API Client"]
    end

    subgraph Editors["Content Team"]
        CMSAdmin["CMS Admin Console"]
        PreviewBrowser["Preview Browser"]
    end

    subgraph AkamaiEdge["Akamai Edge Network (Global PoPs)"]
        direction TB
        WAF["App & API Protector (WAF/DDoS/Bot)"]
        Ion["Ion (Static + Dynamic Delivery)"]
        AMD["Adaptive Media Delivery (Streaming)"]
        IVM["Image & Video Manager"]
        EW["EdgeWorkers (Edge Logic)"]
        EKV["EdgeKV (Edge Config Store)"]
        DS2["DataStream 2 (Edge Logging)"]
        FP["Fast Purge API"]
    end

    subgraph OriginCluster["Origin Cluster (Protected by Site Shield)"]
        direction TB
        LB["Load Balancer (nginx/HAProxy)"]
        WebFront["Next.js Frontend (SSR/ISR)"]
        CMSAPI["CMS API (NestJS)"]
        AdminAPI["Admin API (Internal Only)"]
        PurgeWorker["Purge Worker"]
        PublishWorker["Publish Worker"]
        ReportWorker["Reporting Worker"]
    end

    subgraph DataLayer["Data Layer"]
        PG["PostgreSQL 16 (Primary + Replica)"]
        Redis["Redis 7 Cluster"]
        S3["S3 Object Storage (Media/Assets)"]
        OS["OpenSearch (Search + Logs)"]
        Queue["BullMQ / Redis Queues"]
    end

    subgraph ObsStack["Observability Stack"]
        OTel["OpenTelemetry Collector"]
        Prom["Prometheus"]
        Graf["Grafana"]
        OSLogs["OpenSearch (Logs/Analytics)"]
        Alerts["Alertmanager / PagerDuty"]
    end

    subgraph CICD["CI/CD Pipeline"]
        GHA["GitHub Actions"]
        AkamaiStaging["Akamai Staging Network"]
        Registry["Container Registry"]
    end

    Browser -->|HTTPS| WAF
    VideoPlayer -->|HTTPS HLS/DASH| AMD
    Partner -->|HTTPS API| WAF
    WAF --> Ion
    WAF --> AMD
    WAF --> IVM
    Ion --> EW
    EW --> EKV
    Ion -->|Cache Miss| LB
    AMD -->|Cache Miss| LB
    IVM -->|Transform Request| S3
    LB --> WebFront
    LB --> CMSAPI

    CMSAdmin -->|HTTPS (IP Allowlist + MFA)| AdminAPI
    PreviewBrowser -->|Preview Token| CMSAPI

    CMSAPI --> PG
    CMSAPI --> Redis
    CMSAPI --> S3
    CMSAPI --> OS
    CMSAPI --> Queue
    WebFront --> CMSAPI
    WebFront --> Redis

    Queue --> PublishWorker
    Queue --> PurgeWorker
    Queue --> ReportWorker
    PurgeWorker -->|Fast Purge API| FP
    FP --> Ion

    DS2 -->|Edge Logs| OSLogs
    OTel --> Prom
    OTel --> OSLogs
    Prom --> Graf
    Graf --> Alerts

    GHA --> Registry
    GHA --> AkamaiStaging
    AkamaiStaging -->|Validated| AkamaiEdge
```

---

## Request Flow: Static Content

```mermaid
sequenceDiagram
    participant B as Browser
    participant AK as Akamai Edge (Ion)
    participant Shield as Akamai Origin Shield
    participant Origin as Next.js / CDN Origin

    B->>AK: GET /static/app.a3f2c1.js<br/>Cache-Control: max-age=31536000
    Note over AK: Check edge cache (CP Code: STATIC)
    alt Cache HIT
        AK-->>B: 200 OK + X-Check-Cacheable: YES<br/>Age: 86400<br/>Brotli compressed
    else Cache MISS
        AK->>Shield: Forward to origin shield PoP
        Note over Shield: Check shield cache
        alt Shield HIT
            Shield-->>AK: 200 from shield
            AK-->>B: 200 OK (cached at edge)
        else Shield MISS
            Shield->>Origin: Forward to origin
            Origin-->>Shield: 200 + Cache-Control: max-age=31536000, immutable
            Shield-->>AK: Cache + forward
            AK-->>B: 200 OK
        end
    end
```

**Static Content Cache Key:**
- Scheme + Host + Path
- No query string (stripped for immutable assets)
- No cookies
- Vary: Accept-Encoding (handled by Akamai transparent compression)

---

## Request Flow: Dynamic Content (SSR Page)

```mermaid
sequenceDiagram
    participant B as Browser
    participant AK as Akamai Edge (Ion)
    participant EW as EdgeWorker
    participant Origin as Next.js SSR

    B->>AK: GET /articles/my-article
    Note over AK: Rule match: Dynamic HTML<br/>CP Code: DYNAMIC
    AK->>EW: Execute EdgeWorker
    Note over EW: Read locale from Accept-Language<br/>Read device from UA<br/>Normalize cache key
    EW-->>AK: Cache key: /articles/my-article?locale=en&device=desktop
    Note over AK: Check edge cache
    alt Cache HIT (Surrogate-Key: article:42 page:slug:my-article)
        AK-->>B: 200 Cached HTML<br/>Surrogate-Control: max-age=300
    else Cache MISS
        AK->>Origin: GET /articles/my-article (with X-Akamai-Device, X-Geo headers)
        Origin-->>AK: 200 HTML<br/>Surrogate-Control: max-age=300<br/>Surrogate-Key: article:42 page:my-article template:article-detail
        AK-->>B: 200 HTML (cached at edge, Surrogate-Key stored)
    end
```

**Dynamic Page Cache Key:**
- Scheme + Host + Path
- Normalized query string (allowlist: `page`, `sort`, `filter`)
- Stripped cookies (allowlist: none for public pages)
- Vary: Accept-Language header mapped to locale bucket
- Device group (desktop/mobile/tablet) from UA normalization

---

## Request Flow: Image Optimization

```mermaid
sequenceDiagram
    participant B as Browser (WebP capable)
    participant AK as Akamai IVM
    participant S3 as S3 Origin (Original Images)

    B->>AK: GET /images/hero.jpg?w=800&q=80<br/>Accept: image/webp
    Note over AK: IVM Policy match<br/>Transform: resize 800px, quality 80, convert WebP
    Note over AK: Cache key: path + transform params + Accept bucket
    alt Derivative cached
        AK-->>B: 200 WebP image<br/>Content-Type: image/webp<br/>Cache-Control: max-age=2592000
    else Not cached
        AK->>S3: GET /originals/hero.jpg
        S3-->>AK: 200 JPEG original
        Note over AK: IVM transforms → WebP 800px q80
        AK-->>B: 200 WebP<br/>Vary: Accept
        Note over AK: Cache derivative
    end
```

---

## Request Flow: Video Streaming (VOD HLS)

```mermaid
sequenceDiagram
    participant P as Video Player
    participant AK as Akamai AMD
    participant Tok as Token Auth (EdgeWorker)
    participant Pkg as Packaging Origin / NetStorage

    P->>AK: GET /streams/video-id/master.m3u8?hdnts=<token>
    AK->>Tok: Validate token (EdgeWorker)
    Note over Tok: Verify HMAC, expiry, IP, geo
    alt Token invalid
        Tok-->>P: 403 Forbidden
    else Token valid
        AK->>Pkg: GET manifest (cache miss)
        Pkg-->>AK: 200 Master manifest<br/>Cache-Control: max-age=60
        AK-->>P: 200 Master manifest
        P->>AK: GET /streams/video-id/720p/seg001.ts
        Note over AK: Segment cached? TTL: 3600s
        AK-->>P: 200 Segment (from edge cache)
    end
```

---

## Request Flow: Content Publishing and Cache Purge

```mermaid
sequenceDiagram
    participant Ed as Editor (CMS Admin)
    participant CMSAPI as CMS API
    participant PG as PostgreSQL
    participant Queue as BullMQ Queue
    participant PW as Purge Worker
    participant FP as Akamai Fast Purge API
    participant AK as Akamai Edge

    Ed->>CMSAPI: POST /api/content/articles/42/publish
    CMSAPI->>PG: Update status=published, version++, timestamp
    CMSAPI->>Queue: Enqueue publish event {type: article, id: 42, tags: [...]}
    CMSAPI-->>Ed: 202 Accepted {jobId: "pub-789"}

    Queue->>PW: Dequeue publish event
    PW->>PW: Resolve purge tag dependency graph<br/>article:42 → page:my-article, listing:articles, sitemap
    PW->>FP: POST /ccu/v3/invalidations/tag/production<br/>{"objects":["article:42","page:my-article","listing:articles"]}
    FP-->>PW: 201 {purgeId: "p-xyz", estimatedSeconds: 5}
    PW->>PG: Log purge audit {purgeId, tags, status: submitted}
    
    loop Poll until complete (max 30s)
        PW->>FP: GET /ccu/v3/purges/p-xyz
        FP-->>PW: {status: "In-Progress" | "Done"}
    end
    
    PW->>PG: Update purge audit {status: complete, latencyMs: 4800}
    AK->>AK: Invalidate cached objects matching tags
    Note over AK: Next request re-fetches from origin
```

---

## Request Flow: Reporting and Logging

```mermaid
sequenceDiagram
    participant AK as Akamai Edge
    participant DS2 as DataStream 2
    participant S3L as Log S3 Bucket
    participant Logstash as Logstash / Fluent Bit
    participant OS as OpenSearch
    participant Graf as Grafana Dashboard

    AK->>DS2: Edge log stream (per-request)
    DS2->>S3L: Batch log files (gzip, every ~30s)
    S3L->>Logstash: S3 notification → pull
    Logstash->>Logstash: Parse, enrich, geo-decode
    Logstash->>OS: Index: akamai-access-YYYY.MM.DD
    OS->>Graf: Query via OpenSearch datasource
    Graf-->>Users: Traffic, CHR, WAF, purge dashboards
```

---

## Network Zones

```
┌─────────────────────────────────────────────────────────────┐
│  PUBLIC INTERNET                                            │
│  Users → Akamai Edge PoPs (2000+ globally)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ Akamai SureRoute / Site Shield IPs only
┌──────────────────────▼──────────────────────────────────────┐
│  DMZ / ORIGIN NETWORK                                       │
│  Firewall allows only Akamai Site Shield IP ranges          │
│  Load Balancer → App Servers                                │
└──────────────────────┬──────────────────────────────────────┘
                       │ Private network
┌──────────────────────▼──────────────────────────────────────┐
│  PRIVATE DATA ZONE                                          │
│  PostgreSQL, Redis, S3, OpenSearch                          │
│  No public ingress                                          │
└─────────────────────────────────────────────────────────────┘
                       │ VPN / Bastion only
┌──────────────────────▼──────────────────────────────────────┐
│  ADMIN ZONE                                                 │
│  CMS Admin Console: IP allowlist + SSO/MFA + VPN            │
└─────────────────────────────────────────────────────────────┘
```
