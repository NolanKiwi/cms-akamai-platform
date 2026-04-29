import { Injectable } from '@nestjs/common';
import { AkamaiClient } from './akamai-client.service';

/**
 * EdgeWorkers Management API.
 * https://techdocs.akamai.com/edgeworkers/reference
 *
 * Used to list, deploy and activate edge JavaScript bundles that handle
 * personalisation / A-B / preview-token decoding for dimi-cms.
 */
@Injectable()
export class EdgeWorkersService {
  constructor(private readonly client: AkamaiClient) {}

  listIds() {
    return this.client.request('GET', '/edgeworkers/v1/ids');
  }

  getId(edgeWorkerId: number) {
    return this.client.request('GET', `/edgeworkers/v1/ids/${edgeWorkerId}`);
  }

  listVersions(edgeWorkerId: number) {
    return this.client.request('GET', `/edgeworkers/v1/ids/${edgeWorkerId}/versions`);
  }

  listActivations(edgeWorkerId: number) {
    return this.client.request('GET', `/edgeworkers/v1/ids/${edgeWorkerId}/activations`);
  }

  activate(edgeWorkerId: number, version: string, network: 'STAGING' | 'PRODUCTION', note?: string) {
    return this.client.request(
      'POST',
      `/edgeworkers/v1/ids/${edgeWorkerId}/activations`,
      { network, version, note },
    );
  }
}
