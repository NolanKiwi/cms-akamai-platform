import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';

const INDEX = 'cms-content';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger('SearchService');
  private client: Client;

  constructor(private config: ConfigService) {
    const node = config.get('OPENSEARCH_URL', 'http://localhost:17920');
    this.client = new Client({
      node,
      ssl: { rejectUnauthorized: false },
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.indices.exists({ index: INDEX });
      if (!exists.body) await this.createIndex();
    } catch (e) {
      this.logger.warn(`OpenSearch init failed (non-fatal): ${e.message}`);
    }
  }

  private async createIndex() {
    await this.client.indices.create({
      index: INDEX,
      body: {
        settings: { number_of_shards: 1, number_of_replicas: 1 },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            siteId: { type: 'keyword' },
            contentType: { type: 'keyword' },
            slug: { type: 'keyword' },
            locale: { type: 'keyword' },
            title: { type: 'text', analyzer: 'standard' },
            body: { type: 'text', analyzer: 'standard' },
            tags: { type: 'keyword' },
            publishedAt: { type: 'date' },
            status: { type: 'keyword' },
          },
        },
      },
    });
    this.logger.log(`Created index: ${INDEX}`);
  }

  async indexContent(doc: {
    id: string; siteId: string; contentType: string; slug: string;
    locale: string; title: string; body: string; tags?: string[];
    publishedAt?: Date; status: string;
  }) {
    try {
      await this.client.index({ index: INDEX, id: doc.id, body: doc, refresh: 'wait_for' });
    } catch (e) {
      this.logger.warn(`Index failed for ${doc.id}: ${e.message}`);
    }
  }

  async deleteContent(id: string) {
    try {
      await this.client.delete({ index: INDEX, id });
    } catch (e) {
      this.logger.warn(`Delete failed for ${id}: ${e.message}`);
    }
  }

  async search(query: {
    siteId: string; q: string; contentType?: string; locale?: string;
    page?: number; size?: number;
  }) {
    const { siteId, q, contentType, locale, page = 1, size = 20 } = query;
    const must: any[] = [
      { term: { siteId } },
      { term: { status: 'published' } },
      { multi_match: { query: q, fields: ['title^3', 'body', 'tags^2'], type: 'best_fields' } },
    ];
    if (contentType) must.push({ term: { contentType } });
    if (locale) must.push({ term: { locale } });

    try {
    const result = await this.client.search({
      index: INDEX,
      body: {
        from: (page - 1) * size,
        size,
        query: { bool: { must } },
        highlight: { fields: { title: {}, body: { fragment_size: 150 } } },
      },
    });

    const hits = result.body.hits;
    return {
      total: hits.total.value,
      page, size,
      items: hits.hits.map((h: any) => ({
        id: h._id,
        score: h._score,
        ...h._source,
        highlights: h.highlight,
      })),
    };
    } catch (e) {
      this.logger.warn(`Search unavailable: ${e.message}`);
      return { total: 0, page, size, items: [] };
    }
  }
}
