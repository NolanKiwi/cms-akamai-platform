import { Injectable } from '@nestjs/common';
import { AkamaiClient } from './akamai-client.service';

/**
 * Reporting API — both v1 (named reports, CP-code keyed) and v2 (generic
 * `productFamily/reportingArea/report` taxonomy).
 *
 * Spec source: https://github.com/akamai/akamai-apis/tree/main/apis/reporting-api
 *   - v1: /reporting-api/v1/reports/{name}/versions/{version}/report-data
 *         body shape: { objectIds, metrics, filters: Record<string, string[]> }
 *   - v2: /reporting-api/v2/reports/{productFamily}/{reportingArea}/{report}/data
 *         body shape: { metrics, dimensions?, filters?: Array, sortBys?, limit? }
 */
@Injectable()
export class ReportingService {
  constructor(private readonly client: AkamaiClient) {}

  /**
   * Reporting v1 — named reports. Most CP-code-keyed reports live here
   * (e.g. `hits-by-time`, `traffic-by-time`, `urlhits-by-url`).
   */
  runV1Report(
    name: string,
    body: {
      objectIds: string[]; // CP code IDs (or other business objects)
      metrics: string[];
      filters?: Record<string, string[]>;
    },
    opts: { start: string; end: string; interval?: string; version?: number } = {
      start: '',
      end: '',
    },
  ) {
    const qs = new URLSearchParams();
    if (opts.start) qs.append('start', opts.start);
    if (opts.end) qs.append('end', opts.end);
    if (opts.interval) qs.append('interval', opts.interval);
    const version = opts.version ?? 1;
    return this.client.request(
      'POST',
      `/reporting-api/v1/reports/${name}/versions/${version}/report-data?${qs.toString()}`,
      body,
    );
  }

  /**
   * Reporting v2 — generic `productFamily/reportingArea/report` data query.
   * Browse available reports with `listV2Reports()` first.
   */
  runV2Report(
    productFamily: string,
    reportingArea: string,
    report: string,
    body: {
      metrics: string[];
      dimensions?: string[];
      filters?: Array<{
        dimensionName?: string;
        metricName?: string;
        operator: string;
        expression?: string;
        expressions?: string[];
      }>;
      sortBys?: Array<{ name: string; sortOrder: 'ASCENDING' | 'DESCENDING' }>;
      limit?: number;
    },
    opts: { start?: string; end?: string; interval?: string } = {},
  ) {
    const qs = new URLSearchParams();
    if (opts.start) qs.append('start', opts.start);
    if (opts.end) qs.append('end', opts.end);
    if (opts.interval) qs.append('interval', opts.interval);
    const search = qs.toString();
    return this.client.request(
      'POST',
      `/reporting-api/v2/reports/${productFamily}/${reportingArea}/${report}/data${search ? '?' + search : ''}`,
      body,
    );
  }

  /** GET /reporting-api/v2/reports — list all v2 reports visible to the credential. */
  listV2Reports() {
    return this.client.request('GET', '/reporting-api/v2/reports');
  }

  /** GET /reporting-api/v1/reports — list all v1 named reports. */
  listV1Reports() {
    return this.client.request('GET', '/reporting-api/v1/reports');
  }
}
