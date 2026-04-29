import { Injectable } from '@nestjs/common';
import { AkamaiClient } from './akamai-client.service';

/**
 * Property Manager API (PAPI v1).
 * https://techdocs.akamai.com/property-mgr/reference
 *
 * Used to list/inspect properties (a.k.a. configurations) and edge hostnames
 * that serve dimi-cms sites at the edge.
 */
@Injectable()
export class PapiService {
  constructor(private readonly client: AkamaiClient) {}

  listGroups() {
    return this.client.request('GET', '/papi/v1/groups');
  }

  listContracts() {
    return this.client.request('GET', '/papi/v1/contracts');
  }

  listProducts(contractId: string) {
    return this.client.request('GET', `/papi/v1/products?contractId=${contractId}`);
  }

  listProperties(contractId: string, groupId: string) {
    return this.client.request(
      'GET',
      `/papi/v1/properties?contractId=${contractId}&groupId=${groupId}`,
    );
  }

  getProperty(propertyId: string, contractId: string, groupId: string) {
    return this.client.request(
      'GET',
      `/papi/v1/properties/${propertyId}?contractId=${contractId}&groupId=${groupId}`,
    );
  }

  listEdgeHostnames(contractId: string, groupId: string) {
    return this.client.request(
      'GET',
      `/papi/v1/edgehostnames?contractId=${contractId}&groupId=${groupId}`,
    );
  }

  /** POST /papi/v1/search/find-by-value — search by propertyName / hostname / edgeHostname. */
  searchByValue(query: { propertyName?: string; hostname?: string; edgeHostname?: string }) {
    return this.client.request<any>('POST', '/papi/v1/search/find-by-value', query);
  }

  /** GET /papi/v1/properties/{id}/versions/{v} — version metadata incl. updatedByUser. */
  getPropertyVersion(propertyId: string, version: number, contractId: string, groupId: string) {
    return this.client.request<any>(
      'GET',
      `/papi/v1/properties/${propertyId}/versions/${version}?contractId=${contractId}&groupId=${groupId}`,
    );
  }

  /**
   * Find every property in the account whose first version (= creator) was
   * authored by `username`. Slow but accurate — iterates groups, then for
   * each property fetches v1 metadata and checks `updatedByUser`.
   *
   * Caches results in-process; pass `force=true` to refresh.
   */
  private creatorCache = new Map<
    string,
    { at: number; rows: any[]; scanning?: boolean; lastError?: string; progress?: { groupsScanned: number; totalGroups: number; propertiesScanned: number } }
  >();

  /**
   * Non-blocking variant: kicks off a background scan if none is in flight,
   * and returns the current cache state immediately. Suitable for UI polling.
   */
  startCreatorScan(
    username: string,
    opts: { maxGroups?: number; maxProperties?: number; delayMs?: number; force?: boolean } = {},
  ): { user: string; scanning: boolean; count: number; items: any[]; lastScanAt?: number; lastError?: string; progress?: any } {
    const key = username.toLowerCase();
    const TTL = 10 * 60_000;
    const cached = this.creatorCache.get(key);
    const fresh = cached && !opts.force && Date.now() - cached.at < TTL;
    if (!fresh && !cached?.scanning) {
      const seed = { at: 0, rows: cached?.rows || [], scanning: true, progress: { groupsScanned: 0, totalGroups: 0, propertiesScanned: 0 } };
      this.creatorCache.set(key, seed);
      // fire-and-forget
      this.runScan(username, opts).catch((e) => {
        const cur = this.creatorCache.get(key);
        if (cur) {
          cur.scanning = false;
          cur.lastError = e?.message || String(e);
          cur.at = Date.now();
        }
      });
    }
    const cur = this.creatorCache.get(key);
    return {
      user: username,
      scanning: !!cur?.scanning,
      count: cur?.rows?.length || 0,
      items: cur?.rows || [],
      lastScanAt: cur?.at || undefined,
      lastError: cur?.lastError,
      progress: cur?.progress,
    };
  }

  private async runScan(username: string, opts: { maxGroups?: number; maxProperties?: number; delayMs?: number }) {
    const key = username.toLowerCase();
    const rows = await this.scanCreatorImpl(username, opts);
    this.creatorCache.set(key, {
      at: Date.now(),
      rows,
      scanning: false,
      progress: this.creatorCache.get(key)?.progress,
    });
  }

  private async scanCreatorImpl(
    username: string,
    opts: {
      maxGroups?: number;
      maxProperties?: number;
      delayMs?: number;
    } = {},
  ): Promise<any[]> {
    const key = username.toLowerCase();

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const delay = opts.delayMs ?? 250;
    const withRetry = async <T>(fn: () => Promise<T>, label: string): Promise<T | null> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await fn();
        } catch (e: any) {
          const msg = String(e?.message || '');
          // Akamai 429 → wait and retry, otherwise give up
          if (msg.includes('Akamai 429')) {
            const waitMs = 5_000 * (attempt + 1);
            await sleep(waitMs);
            continue;
          }
          // 404 / 403 on a single property → just skip
          return null;
        }
      }
      return null;
    };

    const groups = await withRetry(
      () => this.client.request<any>('GET', '/papi/v1/groups'),
      'list groups',
    );
    const items: any[] = ((groups as any)?.groups?.items || []).filter(
      (g: any) => Array.isArray(g.contractIds) && g.contractIds.length > 0,
    );

    const out: any[] = [];
    let propertiesScanned = 0;
    const maxGroups = opts.maxGroups ?? items.length;
    const maxProperties = opts.maxProperties ?? 5000;
    const totalGroups = Math.min(items.length, maxGroups);
    const updateProgress = (groupsScanned: number) => {
      const cur = this.creatorCache.get(key);
      if (cur) cur.progress = { groupsScanned, totalGroups, propertiesScanned };
    };
    updateProgress(0);

    for (let i = 0; i < totalGroups; i++) {
      const g = items[i];
      const cid = g.contractIds[0];
      // Stream interim results as we discover them
      this.creatorCache.set(key, {
        ...(this.creatorCache.get(key) as any),
        rows: out.slice(),
        at: Date.now(),
        scanning: true,
      });
      updateProgress(i);
      const resp = await withRetry(
        () =>
          this.client.request<any>(
            'GET',
            `/papi/v1/properties?contractId=${cid}&groupId=${g.groupId}`,
          ),
        `list properties for ${g.groupId}`,
      );
      if (!resp) continue;
      const props: any[] = (resp as any)?.properties?.items || [];
      const concurrency = 5;
      for (let b = 0; b < props.length; b += concurrency) {
        if (propertiesScanned >= maxProperties) return this.cache(key, out);
        const batch = props.slice(b, b + concurrency);
        const results = await Promise.all(
          batch.map((p) =>
            withRetry(
              () => this.getPropertyVersion(p.propertyId, 1, cid, g.groupId),
              `v1 for ${p.propertyId}`,
            ).then((v1) => ({ p, v1 })),
          ),
        );
        propertiesScanned += batch.length;
        updateProgress(i);
        for (const { p, v1 } of results) {
          const versions: any[] = (v1 as any)?.versions?.items || [];
          const author: string | undefined = versions[0]?.updatedByUser;
          if (author && author.toLowerCase() === key) {
            out.push({
              propertyId: p.propertyId,
              propertyName: p.propertyName,
              productionVersion: p.productionVersion,
              stagingVersion: p.stagingVersion,
              latestVersion: p.latestVersion,
              groupId: g.groupId,
              groupName: g.groupName,
              contractId: cid,
              createdBy: author,
              createdAt: versions[0]?.updatedDate,
            });
          }
        }
        if (delay > 0) await sleep(delay);
      }
    }
    return this.cache(key, out);
  }

  private cache(key: string, rows: any[]) {
    this.creatorCache.set(key, { at: Date.now(), rows });
    return rows;
  }
}
