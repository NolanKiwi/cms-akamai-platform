import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import Queue from 'bull';
import { Client as PgClient } from 'pg';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:17379';
const OPENSEARCH_URL = process.env.OPENSEARCH_URL || 'http://localhost:17920';

const queue = new Queue('search', REDIS_URL);
const db = new PgClient({ connectionString: process.env.DATABASE_URL });
const os = new OpenSearchClient({ node: OPENSEARCH_URL, ssl: { rejectUnauthorized: false } });

db.connect().catch(e => console.error('DB:', e.message));

queue.process('index-content', async (job) => {
  const { entryId } = job.data;
  const res = await db.query(
    `SELECT ce.id, ce.site_id, ce.content_type, ce.slug, ce.locale, ce.status, ce.published_at,
            cv.title, cv.fields, cv.cache_tags
     FROM content_entries ce
     LEFT JOIN content_versions cv ON cv.id = ce.current_version_id
     WHERE ce.id = $1`,
    [entryId],
  );
  if (!res.rows.length) return;
  const row = res.rows[0];
  await os.index({
    index: 'cms-content', id: row.id,
    body: {
      id: row.id, siteId: row.site_id, contentType: row.content_type,
      slug: row.slug, locale: row.locale, status: row.status,
      title: row.title || '', body: String(row.fields?.body || ''),
      tags: row.cache_tags || [], publishedAt: row.published_at,
    },
    refresh: 'wait_for',
  });
  console.log(`Indexed: ${row.id} (${row.slug})`);
});

queue.process('delete-content', async (job) => {
  const { entryId } = job.data;
  try { await os.delete({ index: 'cms-content', id: entryId }); }
  catch { /* not found is ok */ }
  console.log(`Deleted from index: ${entryId}`);
});

console.log('Search worker started...');
