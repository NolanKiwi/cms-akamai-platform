# Akamai OPEN API integration map

This document maps the Akamai OPEN APIs that dimi-cms can drive, the credentials required, and where in the codebase each one is wired.

> **Spec sources** — these paths are aligned with the official OpenAPI bundles published in <https://github.com/akamai/akamai-apis>:
> - Fast Purge — `apis/ccu/v3` → `/ccu/v3/{operation}/{scope}/{network}`
> - CP Codes & Reporting Groups — `apis/cprg/v1` → `/cprg/v1/cpcodes`, `/cprg/v1/reporting-groups`
> - Property Manager — `apis/papi/v1` → `/papi/v1/groups`, `/papi/v1/contracts`, `/papi/v1/properties`, `/papi/v1/edgehostnames`
> - Reporting v1 — `apis/reporting-api/v1` → `/reporting-api/v1/reports/{name}/versions/{version}/report-data`
> - Reporting v2 — `apis/reporting-api/v2` → `/reporting-api/v2/reports/{productFamily}/{reportingArea}/{report}/data`
> - EdgeWorkers — `apis/edgeworkers/v1` → `/edgeworkers/v1/ids`, `/edgeworkers/v1/ids/{id}/{versions,activations}`
> - Edge DNS — `apis/config-dns/v2` → `/config-dns/v2/zones/...`
>
> All APIs are published under the same `https://{host}.luna.akamaiapis.net` and authenticated with the same EdgeGrid credential set (`AKAMAI_HOST`, `AKAMAI_CLIENT_TOKEN`, `AKAMAI_CLIENT_SECRET`, `AKAMAI_ACCESS_TOKEN`).

## Credential placement

All four EdgeGrid values come from **Akamai Control Center → Identity & Access → API users → Create API client → "Custom credentials"**. Pick the API permissions during creation that match the table below.

```
.env
  AKAMAI_HOST=akab-xxxxxxxxxx.luna.akamaiapis.net
  AKAMAI_CLIENT_TOKEN=akab-xxxx
  AKAMAI_CLIENT_SECRET=xxxx-xxxx
  AKAMAI_ACCESS_TOKEN=akab-xxxx
  AKAMAI_NETWORK=staging          # or production
  AKAMAI_CONTRACT_ID=ctr_x-xxxx   # used by PAPI calls
  AKAMAI_GROUP_ID=grp_xxxx        # used by PAPI calls
```

When `AKAMAI_HOST` is empty the integration runs in **dry-run mode** — every Akamai call resolves with a synthetic response so the rest of the platform behaves the same way.

## API surface

| API (TechDocs name)              | Base path (verified against akamai/akamai-apis) | Code location                                  | dimi-cms use case |
|----------------------------------|-------------------------------------------------|------------------------------------------------|-------------------|
| Fast Purge / CCU v3              | `/ccu/v3/{op}/{scope}/{network}`                | `apps/cms-api/src/purge/akamai-purge.client.ts` | Cache invalidation on publish/unpublish (already wired). |
| CP Codes & Reporting Groups      | `/cprg/v1/cpcodes`, `/cprg/v1/reporting-groups` | `apps/cms-api/src/akamai/cpcode.service.ts`     | Read CP codes; pair with Reporting for traffic. |
| Property Manager (PAPI)          | `/papi/v1/groups,contracts,properties,edgehostnames` | `apps/cms-api/src/akamai/papi.service.ts` | List/inspect properties + edge hostnames + activations. |
| Reporting v1 (named)             | `/reporting-api/v1/reports/{name}/versions/{v}/report-data` | `apps/cms-api/src/akamai/reporting.service.ts` (`runV1Report`) | CP-code keyed reports (`traffic-by-time`, `hits-by-time`). |
| Reporting v2 (taxonomy)          | `/reporting-api/v2/reports/{productFamily}/{reportingArea}/{report}/data` | `apps/cms-api/src/akamai/reporting.service.ts` (`runV2Report`) | Generic dimensions + metrics queries. |
| EdgeWorkers Management API       | `/edgeworkers/v1/ids[/{id}/{versions,activations}]` | `apps/cms-api/src/akamai/edgeworkers.service.ts`| Deploy + activate edge JS bundles. |
| Edge DNS                         | `/config-dns/v2/zones/...`                      | `apps/cms-api/src/akamai/edge-dns.service.ts`   | Auto-create CNAMEs when sites onboard. |
| Image & Video Manager (IM)       | `/imaging/v2/network/{network}/...`             | _stub: add as needed_                          | Auto-derivative images for the assets pipeline. |
| NetStorage Configuration         | `/storage/v1/...`                               | _stub: add as needed_                          | Source-of-truth for media when not using S3/MinIO. |
| GTM                              | `/config-gtm/v1/domains/...`                    | _stub: add as needed_                          | Multi-region traffic steering. |
| Identity & Access (IAM v1/v2/v3) | `/identity-management/v{1,2,3}/...`             | _stub: add as needed_                          | Provision Akamai users/groups from the admin console. |
| Application Security             | `/appsec/v1/...`                                | _stub: add as needed_                          | Configure WAF policies attached to dimi-cms properties. |

## Generic client

`apps/cms-api/src/akamai/akamai-client.service.ts` exposes a thin `AkamaiClient.request(method, path, body?)` wrapper around the official `akamai-edgegrid` SDK. Each per-API service composes path strings on top of this. Adding a new API surface is one file:

```ts
// apps/cms-api/src/akamai/imaging.service.ts
import { Injectable } from '@nestjs/common';
import { AkamaiClient } from './akamai-client.service';

@Injectable()
export class ImagingService {
  constructor(private readonly client: AkamaiClient) {}
  listPolicies(network: 'staging' | 'production' = 'staging') {
    return this.client.request('GET', `/imaging/v2/network/${network}/policies/image`);
  }
}
```

Then register it in `akamai.module.ts`.

## Admin endpoints

The console exposes these read-only / activation endpoints under `/admin/akamai/*` (auth: `developer` or `admin` role):

| Method | Path                                          | Purpose                                         |
|--------|-----------------------------------------------|-------------------------------------------------|
| GET    | `/admin/akamai/status`                        | `{ dryRun: boolean }` — flips when creds are set |
| GET    | `/admin/akamai/papi/groups`                   | List groups visible to this credential          |
| GET    | `/admin/akamai/papi/contracts`                | List contracts                                  |
| GET    | `/admin/akamai/papi/properties?contractId=…&groupId=…` | List properties under a group         |
| GET    | `/admin/akamai/reporting/edge-traffic?start=…&end=…`   | Edge hits/misses for the dashboard       |
| GET    | `/admin/akamai/edgeworkers`                   | List EdgeWorkers IDs                            |
| POST   | `/admin/akamai/edgeworkers/:id/activate`      | Activate a version on staging/production        |
| GET    | `/admin/akamai/dns/zones`                     | List Edge DNS zones                             |

## Recommended permission set

When you create the API client in Akamai Control Center, grant **Read/Write** for:

- CCU APIs (Fast Purge)
- Property Manager (PAPI)
- Reporting v2
- EdgeWorkers Management
- Edge DNS

…and **Read-only** for IAM until you're confident the admin console should also provision Akamai users.

## Related EdgeGrid mechanics

- **Signing**: HMAC-SHA256 of `(method, host, path, content-hash, headers)` — handled by `akamai-edgegrid` SDK in `akamai-client.service.ts`.
- **Throttling**: Akamai applies per-API quotas. Wrap mutating calls with our existing BullMQ `purge` queue pattern when fan-out is non-trivial.
- **`.edgerc`**: If your team already uses Akamai CLI, copy the `[default]` section values into `.env`. Both work — `.env` wins because dimi-cms doesn't read `.edgerc`.

## Verification

```bash
# In dry-run (no AKAMAI_HOST):
curl -H "Authorization: Bearer $TOKEN" https://dimicms.duckdns.org/api/v1/admin/akamai/status
# → {"dryRun":true}

# After filling in credentials and `pm2 restart cms-api`:
curl -H "Authorization: Bearer $TOKEN" https://dimicms.duckdns.org/api/v1/admin/akamai/status
# → {"dryRun":false}

curl -H "Authorization: Bearer $TOKEN" https://dimicms.duckdns.org/api/v1/admin/akamai/papi/groups
# → real group list
```
