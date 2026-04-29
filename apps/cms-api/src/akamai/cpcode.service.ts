import { Injectable } from '@nestjs/common';
import { AkamaiClient } from './akamai-client.service';
import { ReportingService } from './reporting.service';

/**
 * CP Codes & Reporting Groups API + Reporting v1 (CP-code keyed reports).
 *
 * Spec sources:
 *   - https://github.com/akamai/akamai-apis/tree/main/apis/cprg/v1
 *       paths confirmed: /cprg/v1/cpcodes, /cprg/v1/cpcodes/{cpcodeId},
 *                        /cprg/v1/reporting-groups
 *   - https://github.com/akamai/akamai-apis/tree/main/apis/reporting-api
 *       v1 path: /reporting-api/v1/reports/{name}/versions/{version}/report-data
 *
 * All endpoints exposed by this service are READ-ONLY — safe for first
 * verification when you just plugged in Akamai credentials.
 */
@Injectable()
export class CpCodeService {
  constructor(
    private readonly client: AkamaiClient,
    private readonly reporting: ReportingService,
  ) {}

  /** GET /cprg/v1/cpcodes — list every CP code visible to the credential. */
  list() {
    return this.client.request('GET', '/cprg/v1/cpcodes');
  }

  /** GET /cprg/v1/cpcodes/{cpcodeId} — single CP code metadata. */
  get(cpcodeId: number | string) {
    return this.client.request('GET', `/cprg/v1/cpcodes/${cpcodeId}`);
  }

  /** GET /cprg/v1/reporting-groups — reporting groups (per-CP-code aggregations). */
  listReportingGroups() {
    return this.client.request('GET', '/cprg/v1/reporting-groups');
  }

  /**
   * CP code traffic via Reporting v2 — `delivery/traffic/current`.
   * That report is the canonical place for CDN traffic data by CP code. We
   * filter by CP code and bucket by the requested interval. Override the
   * `report` triple via opts if your account uses a different one
   * (discover with GET /admin/akamai/reporting/v2/reports).
   */
  async traffic(
    cpcodeId: number | string,
    opts: {
      hours?: number;
      interval?: 'FIVE_MINUTES' | 'HOUR' | 'DAY' | 'MONTH';
      productFamily?: string;
      reportingArea?: string;
      report?: string;
    } = {},
  ) {
    const hours = opts.hours ?? 24;
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600_000);

    const dimByInterval: Record<string, string> = {
      FIVE_MINUTES: 'time5minutes',
      HOUR: 'time1hour',
      DAY: 'time1day',
      MONTH: 'time1month',
    };
    const interval = opts.interval || 'HOUR';
    const timeDim = dimByInterval[interval] || 'time1hour';

    return this.reporting.runV2Report(
      opts.productFamily || 'delivery',
      opts.reportingArea || 'traffic',
      opts.report || 'current',
      {
        metrics: ['edgeHitsSum', 'edgeBytesSum', 'originHitsSum', 'originBytesSum'],
        dimensions: ['cpcode', timeDim],
        filters: [
          {
            dimensionName: 'cpcode',
            operator: 'IN_LIST',
            expressions: [String(cpcodeId)],
          },
        ],
        limit: 1000,
      },
      {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    );
  }
}
