import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import cron from 'node-cron';
import { Client as PgClient } from 'pg';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';

const db = new PgClient({ connectionString: process.env.DATABASE_URL });
const os = new OpenSearchClient({ node: process.env.OPENSEARCH_URL || 'http://localhost:17920', ssl: { rejectUnauthorized: false } });

db.connect().catch(e => console.error('DB:', e.message));

async function generateDailyReport() {
  const today = new Date().toISOString().split('T')[0];
  const rows = await db.query(
    `SELECT trigger_type, status, COUNT(*) as count, AVG(latency_ms) as avg_latency
     FROM purge_log WHERE DATE(submitted_at) = $1 GROUP BY trigger_type, status`,
    [today],
  );
  if (rows.rows.length === 0) return;

  await os.index({
    index: 'cms-purge-reports',
    id: `purge-${today}`,
    body: { date: today, stats: rows.rows },
    refresh: 'wait_for',
  });
  console.log(`Daily report indexed: ${today}`);
}

// Generate report daily at midnight
cron.schedule('0 0 * * *', async () => {
  try { await generateDailyReport(); }
  catch (e: any) { console.error('Report error:', e.message); }
});

console.log('Reporting worker started...');
