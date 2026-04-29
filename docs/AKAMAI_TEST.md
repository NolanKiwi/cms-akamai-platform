# Akamai 자격증명 — 어디에 입력하고 어떻게 검증하는가

## 1) 자격증명 발급 (Akamai Control Center)

1. <https://control.akamai.com/> 로그인
2. **Identity & Access** → **API users** → **Create API client** → "Custom" 선택
3. 권한 선택 (이번 read-only 테스트용 최소 권한):
   - **CP codes and Reporting groups** — Read-Only
   - **Property Manager (PAPI)** — Read-Only
   - **Reporting API (v2)** — Read-Only
4. Save → 4개 값을 한 번에 보여줍니다 — 즉시 복사 (다시는 안 보여줌):
   - `host` (akab-xxx.luna.akamaiapis.net)
   - `client_token`
   - `client_secret`
   - `access_token`

## 2) `.env`에 입력

파일: `/home/nolank/project/cms-akamai-platform/.env`

```dotenv
# Akamai
AKAMAI_HOST=akab-xxxxxxxxxxxxxxxx.luna.akamaiapis.net
AKAMAI_CLIENT_TOKEN=akab-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx
AKAMAI_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=
AKAMAI_ACCESS_TOKEN=akab-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx
AKAMAI_NETWORK=staging               # production | staging
AKAMAI_CONTRACT_ID=ctr_X-XXXXXX      # only required by some PAPI calls
AKAMAI_GROUP_ID=grp_XXXXXX           # only required by some PAPI calls
```

> **`.edgerc` 파일에서 옮기는 경우** — `[default]` 섹션의 4개 값(`host`, `client_token`, `client_secret`, `access_token`)이 그대로 위 4개 변수에 1:1로 매핑됩니다.

## 3) 적용

```bash
cd /home/nolank/project/cms-akamai-platform
pm2 restart cms-api
```

## 4) 동작 원리

```
Browser/curl
    │  Authorization: Bearer <JWT>
    ▼
[ nginx :443 ]  TLS 종단
    │
    ▼
[ cms-api :17000 ]  NestJS — JWT/Roles 가드 통과 후
    │
    │  AkamaiClient.request()  (apps/cms-api/src/akamai/akamai-client.service.ts)
    │  └─ akamai-edgegrid SDK가 EdgeGrid v1 서명 (HMAC-SHA256)을 매 요청마다 생성
    │     · Authorization: EG1-HMAC-SHA256 client_token=…;access_token=…;timestamp=…;nonce=…;signature=…
    ▼
https://AKAMAI_HOST/<path>   ← OPEN API endpoint (PAPI / CPRG / Reporting / EdgeWorkers / Edge DNS …)
```

`AKAMAI_HOST`가 비어 있으면 자동으로 **dry-run** 모드 — 모든 호출이 `{dryRun:true}`만 반환하고 외부 요청을 보내지 않습니다.

## 5) 가장 안전한 read-only 검증 (CP code Reporting)

> 이 절의 모든 경로는 공식 OpenAPI 번들 <https://github.com/akamai/akamai-apis>에서 검증한 spec과 일치합니다 (`apis/cprg/v1`, `apis/papi/v1`, `apis/reporting-api/v1`).


### 5-1. 한 줄 명령
```bash
ADMIN_EMAIL=admin@dimicms.local \
ADMIN_PASSWORD='Dimicms123!@#' \
bash /home/nolank/project/cms-akamai-platform/scripts/test-akamai.sh
```

이 스크립트가 순서대로 호출하는 4개 read-only 엔드포인트:

| Step | 엔드포인트                                              | Akamai API (spec 경로)           |
|------|---------------------------------------------------------|----------------------------------|
| 1    | `GET /admin/akamai/status`                              | (none — 자격증명 로드 여부만)    |
| 2    | `GET /admin/akamai/cpcodes`                             | `GET /cprg/v1/cpcodes`           |
| 3    | `GET /admin/akamai/papi/groups`                         | `GET /papi/v1/groups`            |
| 4    | `GET /admin/akamai/cpcodes/<id>/traffic?hours=24`       | `POST /reporting-api/v1/reports/traffic-by-time/versions/1/report-data` |

### 5-2. 수동 검증
```bash
# 1) 로그인 → 토큰
TOKEN=$(curl -s -X POST https://dimicms.duckdns.org/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dimicms.local","password":"Dimicms123!@#"}' \
  | jq -r .accessToken)

# 2) 자격증명 로드 여부
curl -s -H "Authorization: Bearer $TOKEN" \
  https://dimicms.duckdns.org/api/v1/admin/akamai/status
# → {"dryRun":false}    ← 이게 false 여야 진짜 호출됨

# 3) CP code 목록 (read-only, 가장 안전)
curl -s -H "Authorization: Bearer $TOKEN" \
  https://dimicms.duckdns.org/api/v1/admin/akamai/cpcodes \
  | jq '.cpcodes[0:3]'

# 4) 단건 조회
curl -s -H "Authorization: Bearer $TOKEN" \
  https://dimicms.duckdns.org/api/v1/admin/akamai/cpcodes/123456 \
  | jq

# 5) 24시간 트래픽 (Reporting v2)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://dimicms.duckdns.org/api/v1/admin/akamai/cpcodes/123456/traffic?hours=24" \
  | jq
```

## 6) 자주 만나는 실패 원인

| 증상 | 원인 / 처방 |
|---|---|
| `{"dryRun":true}` | `.env`의 `AKAMAI_HOST`가 비어있음. 채우고 `pm2 restart cms-api` |
| `Akamai 401: ...` | client_token/access_token/client_secret 중 하나가 잘못됨. Control Center에서 재발급 |
| `Akamai 403: ...` | 자격증명에 해당 API 권한이 없음 (예: CP codes만 가능, Reporting 권한 없음) |
| `Akamai 400: invalid timestamp` | 호스트 시계 어긋남. `sudo timedatectl set-ntp true` |
| `connect ETIMEDOUT` | 방화벽이 outbound 443 차단. `curl -I https://AKAMAI_HOST` 직접 확인 |

## 7) 운영 시 주의

- **dryRun=false에서 `/api/v1/admin/purge/*` 라우트는 진짜 캐시를 무효화합니다.** 처음엔 반드시 `AKAMAI_NETWORK=staging`으로 두세요.
- `.env`는 `chmod 600` 권장. `.gitignore`에 이미 들어있는지 확인 (`grep '^.env$' .gitignore`).
- 자격증명 노출이 의심되면 Control Center에서 **Revoke**한 뒤 새로 발급. dimi-cms는 즉시 다음 요청부터 새 값을 사용합니다 (`pm2 restart cms-api` 1회).
