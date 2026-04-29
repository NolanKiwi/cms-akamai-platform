import { Injectable } from '@nestjs/common';
import { AkamaiClient } from './akamai-client.service';

/**
 * Edge DNS API (formerly Fast DNS).
 * https://techdocs.akamai.com/edge-dns/reference
 *
 * Used by dimi-cms when sites onboard and need an apex/CNAME record set up
 * automatically before edge hostname activation.
 */
@Injectable()
export class EdgeDnsService {
  constructor(private readonly client: AkamaiClient) {}

  listZones() {
    return this.client.request('GET', '/config-dns/v2/zones');
  }

  getZone(zone: string) {
    return this.client.request('GET', `/config-dns/v2/zones/${zone}`);
  }

  listRecordSets(zone: string) {
    return this.client.request('GET', `/config-dns/v2/zones/${zone}/recordsets`);
  }

  upsertRecordSet(
    zone: string,
    name: string,
    type: string,
    body: { ttl: number; rdata: string[] },
  ) {
    return this.client.request(
      'PUT',
      `/config-dns/v2/zones/${zone}/names/${encodeURIComponent(name)}/types/${type}`,
      body,
    );
  }
}
