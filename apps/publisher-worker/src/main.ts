import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import cron from 'node-cron';
import { Client } from 'pg';

const db = new Client({ connectionString: process.env.DATABASE_URL });
db.connect().catch(e => console.error('DB connect failed:', e.message));

async function publishScheduled() {
  const now = new Date();
  const result = await db.query(
    `UPDATE content_entries SET status='published', published_at=$1
     WHERE status='scheduled' AND scheduled_at <= $1 RETURNING id, slug`,
    [now],
  );
  if (result.rowCount && result.rowCount > 0) {
    console.log(`Published ${result.rowCount} scheduled entries`, result.rows.map((r: any) => r.slug));
  }
}

cron.schedule('* * * * *', async () => {
  try { await publishScheduled(); }
  catch (e: any) { console.error('Scheduled publish error:', e.message); }
});

console.log('Publisher worker started, checking every minute...');
