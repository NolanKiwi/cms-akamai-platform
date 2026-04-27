# Streaming and Media Strategy

## Streaming Architecture Overview

```
                    ┌──────────────────────────────────────────┐
                    │  CMS Admin Console                        │
                    │  - Register video                         │
                    │  - Set geo restriction                    │
                    │  - Configure token auth                   │
                    │  - Set thumbnail                          │
                    └──────────────────┬───────────────────────┘
                                       │ Video metadata stored in DB
                    ┌──────────────────▼───────────────────────┐
                    │  Origin Video Pipeline                    │
                    │  Upload → Transcode → Package → Publish  │
                    └──────────────────┬───────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                         │
    ┌─────────▼─────────┐   ┌─────────▼─────────┐   ┌─────────▼─────────┐
    │  S3 / NetStorage  │   │  Packaging Origin  │   │  Akamai AMD Edge  │
    │  (source files)   │   │  (HLS/DASH muxer)  │   │  (delivery)       │
    └───────────────────┘   └───────────────────┘   └───────────────────┘
```

---

## VOD Workflow

### 1. Video Upload and Registration

```
1. Editor creates video_assets entry in CMS:
   {title, description, geo_restriction, token_required}

2. Editor uploads video file:
   - Same presigned S3 upload flow as media assets
   - Separate S3 bucket: s3://cms-video-source-production/

3. On upload complete → CMS API emits video.uploaded event

4. Transcoding worker (Fargate/Lambda):
   - Triggers video transcoding job (AWS MediaConvert, Mux, or self-hosted FFmpeg cluster)
   - Target renditions:
     * 2160p (4K): 15-20 Mbps (if source permits)
     * 1080p:      8 Mbps
     * 720p:       4 Mbps
     * 480p:       2 Mbps
     * 360p:       1 Mbps
     * 240p:       500 Kbps (mobile low-bandwidth)
   - Audio: AAC-LC, 192 kbps stereo
   - Closed captions: pass through / extract to WebVTT

5. Packaging:
   Option A: Pre-packaged HLS/DASH
     - MediaConvert outputs HLS and DASH manifests
     - Stored in S3 or Akamai NetStorage
     - Static segments (immutable)
     - Simple caching (long TTL on segments)
     
   Option B: Just-in-time packaging (Origin Packager)
     - Source stored as fragmented MP4
     - Origin packaging service (e.g., Shaka Packager, Elemental) packages on demand
     - Akamai caches packaged output
     - More flexible (single-source, multiple format output)
     - More complex origin setup

   RECOMMENDED: Option A (pre-packaged) for MVP; migrate to origin packaging for scale

6. On transcode complete:
   - Update video_assets: {hls_url, dash_url, duration_ms, status: 'ready'}
   - Generate thumbnail at 10% duration
   - Notify editor via webhook / admin UI

7. CMS emits video.ready event → optional purge if video was previously referenced
```

### 2. HLS Delivery Structure

```
Master Manifest:
  https://streams.example.com/streams/{video_id}/master.m3u8

Contents:
  #EXTM3U
  #EXT-X-VERSION:3
  #EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080
  720p/playlist.m3u8
  #EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1280x720
  480p/playlist.m3u8
  ...

Variant Playlist:
  https://streams.example.com/streams/{video_id}/720p/playlist.m3u8

Contents:
  #EXTM3U
  #EXT-X-VERSION:3
  #EXT-X-TARGETDURATION:6
  #EXTINF:6.0,
  seg001.ts
  #EXTINF:6.0,
  seg002.ts
  ...
  #EXT-X-ENDLIST

Segments:
  https://streams.example.com/streams/{video_id}/720p/seg001.ts

Storage:
  Akamai NetStorage (preferred — co-located with AMD edge network):
    /netstorage/cms-media-production/streams/{video_id}/
    
  OR: S3 origin (standard, slightly higher latency for first cache fill):
    s3://cms-video-processed/streams/{video_id}/
```

### 3. VOD Caching Strategy

```
Master manifest:
  Cache-Control: max-age=60, stale-while-revalidate=300
  Surrogate-Control: max-age=60
  Surrogate-Key: stream:{video_id}
  Note: Short TTL allows manifest updates (new renditions, captions added)

Variant playlist:
  Cache-Control: max-age=300, stale-while-revalidate=3600
  Surrogate-Control: max-age=300
  Surrogate-Key: stream:{video_id}

Segments (.ts, .m4s):
  Cache-Control: max-age=86400, immutable
  Surrogate-Control: max-age=86400
  Note: Segments are immutable once transcoded (content hash guaranteed)
  No Surrogate-Key needed (segments are never individually invalidated)

On video metadata update (title, geo, etc.):
  Purge: stream:{video_id} → clears manifests (segments remain cached, correct)

On video replacement (re-encode):
  1. New video_id for new version (prefer this approach)
  2. OR: explicit segment delete purge + manifest invalidate
```

---

## Live Streaming Workflow

```
Live event workflow:

1. Editor creates live_event in CMS:
   {title, scheduled_start, scheduled_end, stream_key (secure), geo_restriction}
   
2. Encoder (OBS, hardware encoder, cloud encoder) pushes RTMP/SRT to:
   Live stream ingest endpoint: rtmp://ingest.internal.example.com/live/{stream_key}
   
3. Ingest server (Nginx-RTMP or Wowza or Elemental Live):
   - Receives RTMP
   - Transcodes to multiple bitrates (1080p, 720p, 480p, 360p)
   - Packages to HLS (2-6 second segments)
   - Pushes segments to origin (HTTP PUT to origin packager or NetStorage)
   
4. Akamai AMD edge:
   - Pulls HLS segments from origin on request
   - Caches with very short TTL (3-6 seconds = 1 segment duration)
   - DVR window: cache last 30 minutes of segments (if DVR enabled)
   
5. Viewer player:
   - Requests master manifest: https://streams.example.com/streams/live/{event_id}/master.m3u8
   - Follows variant playlist for adaptive bitrate
   - Polls for new segments as they appear

6. Event end:
   - Encoder stops pushing RTMP
   - Final manifest includes #EXT-X-ENDLIST
   - Live session transitions to VOD (if recording enabled)
   - VOD transcoding triggered automatically
   
Live segment caching:
  Segment TTL: 3 seconds (same as segment duration — barely cached, ensures freshness)
  Manifest TTL: 2 seconds
  DVR segments (older): 30 minutes
  
Live token auth:
  Same token mechanism as VOD, but token must have extended validity (event duration)
  Recommend: 8-hour tokens for live events (not 4-hour like VOD)
```

---

## Image Optimization Pipeline

### IVM Policy Configuration

```json
{
  "name": "cms-responsive-images",
  "transformations": [
    {
      "transformation": "MaxDimension",
      "dimension": "width",
      "value": 3840,
      "allow_enlargement": false
    },
    {
      "transformation": "Compress",
      "quality": 80
    },
    {
      "transformation": "AutoOrient"
    },
    {
      "transformation": "Strip",
      "tags": ["ExifData", "XmpData", "IptcData"]
    }
  ],
  "output": {
    "adaptive_image_compression": true,
    "formats": [
      {"format": "AVIF", "accept": "image/avif"},
      {"format": "WEBP", "accept": "image/webp"},
      {"format": "SOURCE"}
    ]
  }
}
```

### Responsive Image Pattern (Next.js)

```tsx
// In Next.js frontend
import Image from 'next/image';

// IVM-backed image with responsive sizes
export function CMSImage({ asset, alt, priority }: Props) {
  // CDN URL with IVM transformation parameters
  const loaderUrl = ({ src, width, quality }: ImageLoaderProps) =>
    `https://cdn.example.com${src}?w=${width}&q=${quality ?? 80}`;
  
  return (
    <Image
      loader={loaderUrl}
      src={asset.cdnPath}
      alt={alt}
      width={asset.width}
      height={asset.height}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
      priority={priority}
    />
  );
}
```

### Image Transformation Cache Key Warning

```
RISK: Unbounded query parameters = unbounded cache key variants = cache fragmentation

Mitigation:
  1. Validate ?w= parameter against allowlist: [320, 480, 640, 768, 1024, 1280, 1920, 2560, 3840]
  2. Validate ?q= against: [60, 70, 75, 80, 85, 90]
  3. Validate ?f= against: [webp, avif, jpeg, png]
  4. Akamai IVM policy enforces server-side (even if client sends arbitrary values)
  5. Cache key: path + w + q + f + Accept-bucket (avif|webp|jpeg)
  6. Any out-of-range values → normalize to nearest valid value (not reject)
```

---

## Media Storage Strategy

```
S3 Bucket Layout:

cms-media-production/
├── originals/                    # Source images, documents
│   └── {site_id}/{yyyy}/{mm}/
│       └── {asset_id}.{ext}
├── thumbnails/                   # Pre-generated thumbnails
│   └── {asset_id}-{w}x{h}.{format}
└── metadata/                     # Side-car metadata JSON files
    └── {asset_id}.json

cms-video-source-production/      # Raw uploaded video files
└── {asset_id}/
    └── original.{ext}

cms-video-processed-production/   # Transcoded HLS/DASH output
└── {video_id}/
    ├── master.m3u8
    ├── 1080p/
    │   ├── playlist.m3u8
    │   └── seg{NNN}.ts
    └── 720p/
        ├── playlist.m3u8
        └── seg{NNN}.ts

S3 Configuration:
  Versioning: enabled (all buckets)
  Replication: cross-region (to DR region)
  Lifecycle: originals/ → Glacier after 2 years (inactive assets)
  Access: private (all objects private by default)
  Public access: via Akamai CDN only (no direct S3 public access)
  Server-side encryption: AES-256 (SSE-S3) or SSE-KMS
```

---

## SSAI Hook Points (Future)

```
Server-Side Ad Insertion (Phase 9+):

Architecture:
  1. Video stream contains SCTE-35 cue-out markers (ad break signals)
  2. SSAI service intercepts manifest requests
  3. Replaces ad break segments with ad content segments
  4. Returns stitched manifest to player (seamless playback)
  
Akamai integration point:
  - Adaptive Media Delivery supports SSAI integration [ENTITLEMENT]
  - OR: Third-party SSAI (Google DAI, Yospace, AWS MediaTailor)
  
CMS preparation now:
  - Store ad break timecodes in video_assets.metadata.ad_breaks
  - Store IAB content rating in metadata.content_rating
  - Store audience segments in metadata.audience_tags
  - These will feed SSAI targeting when implemented
  
SCTE-35 insertion (production):
  - Live: configure encoder to insert SCTE-35 packets
  - VOD: FFmpeg post-processing to inject SCTE-35 at specified timecodes
```

---

## Thumbnail Generation

```
Image thumbnails:
  Generated at upload time by CMS API using sharp:
  
  const thumbnail = await sharp(inputBuffer)
    .resize(400, 300, {
      fit: 'cover',
      position: asset.focalPoint
        ? sharp.strategy.entropy
        : 'center'
    })
    .webp({ quality: 75 })
    .toBuffer();
  
  Stored at: s3://cms-media-production/thumbnails/{asset_id}-400x300.webp
  CDN URL: https://cdn.example.com/thumbnails/{asset_id}-400x300.webp

Video thumbnails:
  Generated by transcoding pipeline at:
    - 10% of video duration (default)
    - Specific timestamp if specified by editor
    - Multiple thumbnails generated; editor selects in admin console
    
  Tool: FFmpeg
  ffmpeg -ss {timestamp} -i {input} -vframes 1 -q:v 2 thumbnail.jpg
  
  Uploaded to S3, CDN URL stored in video_assets.thumbnail_url
```

---

## Geo Restriction Implementation

```
Video geo restriction stored in CMS:
  video_assets.geo_restriction = {
    mode: 'allow',          // or 'deny'
    countries: ['US', 'CA', 'GB', 'AU']  // ISO 3166-1 alpha-2
  }
  
Synced to EdgeKV on video update:
  Key: geo-restriction:{video_id}
  Value: '{"mode":"allow","countries":["US","CA","GB","AU"]}'
  
EdgeWorker reads on every manifest/segment request:
  const geoConfig = await ekv.getText({ item: `geo-restriction:${videoId}` });
  if (geoConfig) {
    const { mode, countries } = JSON.parse(geoConfig);
    const clientCountry = request.getHeader('X-Akamai-Country');
    
    const inList = countries.includes(clientCountry);
    const blocked = (mode === 'allow' && !inList) || (mode === 'deny' && inList);
    
    if (blocked) {
      request.respondWith(403, {}, JSON.stringify({ error: 'Content not available in your region' }));
      return;
    }
  }
  
Notes:
  - Akamai geo detection is accurate (Akamai IP intelligence database)
  - VPN bypass: partially mitigated (Akamai detects many VPN exit nodes)
  - Legal compliance: geo restriction is a technical control, not legal guarantee
  - Geo restriction + token auth: use both for licensed content
```
