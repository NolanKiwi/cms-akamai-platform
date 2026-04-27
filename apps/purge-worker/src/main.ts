import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import Queue from 'bull';
import { createHmac } from 'crypto';
import * as https from 'https';
import { v4 as uuidv4 } from 'uuid';
import { Client } from 'pg';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:17379';
const AKAMAI_HOST = process.env.AKAMAI_HOST || '';
const AKAMAI_CLIENT_TOKEN = process.env.AKAMAI_CLIENT_TOKEN || '';
const AKAMAI_CLIENT_SECRET = process.env.AKAMAI_CLIENT_SECRET || '';
const AKAMAI_ACCESS_TOKEN = process.env.AKAMAI_ACCESS_TOKEN || '';
const DRY_RUN = !AKAMAI_HOST || process.env.NODE_ENV === 'development';

const purgeQueue = new Queue('purge', REDIS_URL);

const db = new Client({ connectionString: process.env.DATABASE_URL });
db.connect().catch(e => console.error('DB connect failed:', e.message));

async function updateLog(id: string, data: Record<string, unknown>) {
  await db.query(
    `UPDATE purge_log SET status=$1, akamai_purge_id=$2, latency_ms=$3, completed_at=$4, error_message=$5 WHERE id=$6`,
    [data.status, data.akamaiPurgeId || null, data.latencyMs || null, data.completedAt || null, data.errorMessage || null, id],
  );
}

async function akamaiPurge(scope: string, objects: string[], network: string): Promise<string> {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Purge: ${scope} ${objects.length} objects`);
    return `dry-run-${uuidv4()}`;
  }

  const path = `/ccu/v3/invalidations/${scope}/${network}`;
  const body = JSON.stringify({ objects });
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, '+0000');
  const nonce = uuidv4();
  const authHeader = buildAuth('POST', path, body, ts, nonce);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: AKAMAI_HOST, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Authorization: authHeader },
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => res.statusCode === 201 ? resolve(JSON.parse(d).purgeId) : reject(new Error(`${res.statusCode} ${d}`)));
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

function buildAuth(method: string, path: string, body: string, ts: string, nonce: string): string {
  const hdr = `EG1-HMAC-SHA256 client_token=${AKAMAI_CLIENT_TOKEN};access_token=${AKAMAI_ACCESS_TOKEN};timestamp=${ts};nonce=${nonce};`;
  const bodyHash = body ? createHmac('sha256', AKAMAI_CLIENT_SECRET).update(body).digest('base64') : '';
  const sigData = [method, 'https', AKAMAI_HOST, path, '', bodyHash, hdr].join('\t');
  const sig = createHmac('sha256', AKAMAI_CLIENT_SECRET).update(sigData).digest('base64');
  return `${hdr}signature=${sig}`;
}

purgeQueue.process('execute-purge', async (job) => {
  const { purgeLogId, scope, objects, triggerType } = job.data;
  const start = Date.now();
  const network = process.env.AKAMAI_NETWORK || 'staging';

  try {
    await db.query(`UPDATE purge_log SET status='in_progress' WHERE id=$1`, [purgeLogId]);
    const chunks: string[][] = [];
    for (let i = 0; i < objects.length; i += 1000) chunks.push(objects.slice(i, i + 1000));

    let firstPurgeId = '';
    for (const chunk of chunks) {
      const pid = await akamaiPurge(scope, chunk, network);
      if (!firstPurgeId) firstPurgeId = pid;
      console.log(`Purge submitted: ${pid} (${chunk.length} objects)`);
    }

    await updateLog(purgeLogId, {
      status: 'complete', akamaiPurgeId: firstPurgeId,
      latencyMs: Date.now() - start, completedAt: new Date(),
    });
    console.log(`Purge complete: ${purgeLogId}`);
  } catch (err: any) {
    await updateLog(purgeLogId, {
      status: 'failed', latencyMs: Date.now() - start,
      completedAt: new Date(), errorMessage: err.message,
    });
    throw err;
  }
});

console.log('Purge worker started, waiting for jobs...');
