import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as https from 'https';
import * as http from 'http';
import * as url from 'url';

export interface PurgeRequest {
  scope: 'tag' | 'url' | 'cpcode';
  objects: string[];
  network: 'production' | 'staging';
  type?: 'invalidations' | 'deletions';
}

export interface PurgeResponse {
  purgeId: string;
  httpStatus: number;
  estimatedSeconds: number;
  detail: string;
}

@Injectable()
export class AkamaiPurgeClient {
  private readonly logger = new Logger('AkamaiPurgeClient');
  private readonly host: string;
  private readonly clientToken: string;
  private readonly clientSecret: string;
  private readonly accessToken: string;
  private readonly dryRun: boolean;

  constructor(private config: ConfigService) {
    this.host = config.get<string>('AKAMAI_HOST', '');
    this.clientToken = config.get<string>('AKAMAI_CLIENT_TOKEN', '');
    this.clientSecret = config.get<string>('AKAMAI_CLIENT_SECRET', '');
    this.accessToken = config.get<string>('AKAMAI_ACCESS_TOKEN', '');
    this.dryRun = !this.host || config.get('NODE_ENV') === 'development';
  }

  async invalidate(req: PurgeRequest): Promise<PurgeResponse> {
    const operation = req.type || 'invalidations';
    const scopePath = req.scope === 'tag' ? 'tag' : req.scope === 'url' ? 'url' : 'cpcode';
    const path = `/ccu/v3/${operation}/${scopePath}/${req.network}`;

    if (this.dryRun) {
      this.logger.log(`[DRY RUN] Purge: ${path} objects=${req.objects.length}`);
      return {
        purgeId: `dry-run-${uuidv4()}`,
        httpStatus: 201,
        estimatedSeconds: 0,
        detail: 'DRY RUN - Akamai credentials not configured',
      };
    }

    return this.makeRequest(path, req.objects);
  }

  async getPurgeStatus(purgeId: string): Promise<'In-Progress' | 'Done' | 'Failed'> {
    if (purgeId.startsWith('dry-run-')) return 'Done';

    if (this.dryRun) return 'Done';

    try {
      const result = await this.makeGetRequest(`/ccu/v3/purges/${purgeId}`);
      return result.detail === 'Done' ? 'Done' : result.detail === 'Failed' ? 'Failed' : 'In-Progress';
    } catch {
      return 'In-Progress';
    }
  }

  private async makeRequest(path: string, objects: string[]): Promise<PurgeResponse> {
    const body = JSON.stringify({ objects });
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '+0000');
    const nonce = uuidv4();

    const authHeader = this.buildAuthHeader('POST', path, body, timestamp, nonce);

    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.host,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: authHeader,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 201) {
            reject(new Error(`Purge API error: ${res.statusCode} ${data}`));
            return;
          }
          resolve(JSON.parse(data));
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private async makeGetRequest(path: string): Promise<any> {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '+0000');
    const nonce = uuidv4();
    const authHeader = this.buildAuthHeader('GET', path, '', timestamp, nonce);

    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.host,
        path,
        method: 'GET',
        headers: { Authorization: authHeader },
      };

      https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
  }

  private buildAuthHeader(method: string, path: string, body: string, timestamp: string, nonce: string): string {
    const clientTokenHeader = `client_token=${this.clientToken}`;
    const accessTokenHeader = `access_token=${this.accessToken}`;
    const timestampHeader = `timestamp=${timestamp}`;
    const nonceHeader = `nonce=${nonce}`;

    const authHeader = `EG1-HMAC-SHA256 ${clientTokenHeader};${accessTokenHeader};${timestampHeader};${nonceHeader};`;

    const bodyHash = body
      ? createHmac('sha256', this.clientSecret).update(body).digest('base64')
      : '';

    const signingData = [method, 'https', this.host, path, '', bodyHash, authHeader].join('\t');
    const signature = createHmac('sha256', this.clientSecret)
      .update(signingData)
      .digest('base64');

    return `${authHeader}signature=${signature}`;
  }
}
