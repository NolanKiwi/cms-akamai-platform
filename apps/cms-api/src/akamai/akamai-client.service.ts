import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const EdgeGrid = require('akamai-edgegrid');

/**
 * Generic Akamai OPEN API client.
 *
 * - Signs requests with EdgeGrid v1 using credentials from `.env`.
 * - In "dry-run" mode (no AKAMAI_HOST configured) every call resolves with
 *   a synthetic response so the rest of the platform behaves the same way.
 *
 * The same credential set covers all OPEN APIs (Fast Purge, PAPI, Reporting,
 * IM, EdgeWorkers, Edge DNS, IAM, …). Only the API base path differs per
 * service — we expose a generic `request()` that callers point at.
 */
@Injectable()
export class AkamaiClient {
  private readonly logger = new Logger('AkamaiClient');
  private readonly host: string;
  private readonly clientToken: string;
  private readonly clientSecret: string;
  private readonly accessToken: string;
  private readonly dryRun: boolean;

  constructor(private readonly config: ConfigService) {
    this.host = (config.get<string>('AKAMAI_HOST') || '').trim();
    this.clientToken = config.get<string>('AKAMAI_CLIENT_TOKEN') || '';
    this.clientSecret = config.get<string>('AKAMAI_CLIENT_SECRET') || '';
    this.accessToken = config.get<string>('AKAMAI_ACCESS_TOKEN') || '';
    // dry-run only when host is missing — being NODE_ENV=development with
    // real creds should still hit Akamai staging.
    this.dryRun = !this.host;
  }

  isDryRun() {
    return this.dryRun;
  }

  /**
   * Make a signed request against an Akamai OPEN API and return the
   * full response envelope (status + headers + body). Useful for the
   * admin API tester which displays raw response metadata.
   */
  async requestRaw(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: any,
  ): Promise<{ dryRun: boolean; status: number; statusText?: string; headers?: Record<string, string>; data: any }> {
    if (this.dryRun) {
      this.logger.warn(`[DRY RUN] ${method} ${path}`);
      return { dryRun: true, status: 200, statusText: 'OK (dry-run)', headers: {}, data: { dryRun: true, method, path, body } };
    }
    const eg = new EdgeGrid(this.clientToken, this.clientSecret, this.accessToken, `https://${this.host}`);
    return new Promise((resolve, reject) => {
      eg.auth({
        path,
        method,
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      eg.send((error: any, response: any, responseBody: any) => {
        const status = response?.status ?? response?.statusCode ?? error?.response?.status ?? 0;
        const headers = (response?.headers ?? error?.response?.headers ?? {}) as Record<string, string>;
        let data: any = responseBody;
        if (data === undefined) data = error?.response?.data ?? response?.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch { /* keep string */ }
        }
        if (error && status === 0) {
          return reject(new Error(error?.message || String(error)));
        }
        resolve({ dryRun: false, status, statusText: response?.statusText, headers, data });
      });
    });
  }

  /**
   * Make a signed request against an Akamai OPEN API.
   * @param method HTTP method
   * @param path  Path starting with `/`, e.g. `/papi/v1/contracts`
   * @param body  optional JSON body (object) — auto-serialised
   */
  async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: any,
  ): Promise<T> {
    if (this.dryRun) {
      this.logger.warn(`[DRY RUN] ${method} ${path}`);
      return { dryRun: true, method, path, body } as unknown as T;
    }

    const eg = new EdgeGrid(this.clientToken, this.clientSecret, this.accessToken, `https://${this.host}`);
    return new Promise<T>((resolve, reject) => {
      eg.auth({
        path,
        method,
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      eg.send((error: any, response: any, responseBody: any) => {
        if (error) {
          // axios errors expose the upstream body on error.response.data
          const upstream = error?.response?.data ?? error?.message ?? String(error);
          const status = error?.response?.status ?? 0;
          return reject(new Error(`Akamai ${status}: ${typeof upstream === 'string' ? upstream : JSON.stringify(upstream)}`));
        }
        // The SDK uses axios; success path: response.status, body is JSON-stringified
        const status = response?.status ?? response?.statusCode ?? 0;
        if (status && (status < 200 || status >= 300)) {
          return reject(new Error(`Akamai ${status}: ${responseBody}`));
        }
        try {
          if (typeof responseBody === 'string') resolve(JSON.parse(responseBody));
          else if (response?.data !== undefined) resolve(response.data as T);
          else resolve(responseBody as T);
        } catch {
          resolve(responseBody as T);
        }
      });
    });
  }
}
