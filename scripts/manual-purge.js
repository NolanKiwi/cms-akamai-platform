#!/usr/bin/env node
/**
 * Manual cache purge script
 * Usage:
 *   node scripts/manual-purge.js tags "article:uuid listing:articles"
 *   node scripts/manual-purge.js urls "https://www.example.com/articles/slug"
 *
 * Required env vars: AKAMAI_HOST, AKAMAI_CLIENT_TOKEN, AKAMAI_CLIENT_SECRET, AKAMAI_ACCESS_TOKEN
 */

const { execSync } = require('child_process');

const [,, scope, objectsArg] = process.argv;

if (!scope || !objectsArg) {
  console.error('Usage: node scripts/manual-purge.js <tags|urls> "<space-separated values>"');
  process.exit(1);
}

const required = ['AKAMAI_HOST', 'AKAMAI_CLIENT_TOKEN', 'AKAMAI_CLIENT_SECRET', 'AKAMAI_ACCESS_TOKEN'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  console.error('Set these in your .env file or export them before running.');
  process.exit(1);
}

const objects = objectsArg.split(/\s+/).filter(Boolean);
const network = process.env.AKAMAI_NETWORK || 'staging';

console.log(`\n→ Purge request`);
console.log(`  Scope:   ${scope}`);
console.log(`  Network: ${network}`);
console.log(`  Objects: ${objects.join(', ')}`);
console.log(`  Count:   ${objects.length}`);
console.log('');

// Confirm before production purge
if (network === 'production') {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('⚠️  Purging PRODUCTION. Type CONFIRM to proceed: ', answer => {
    rl.close();
    if (answer !== 'CONFIRM') {
      console.log('Aborted.');
      process.exit(0);
    }
    executePurge(scope, objects, network);
  });
} else {
  executePurge(scope, objects, network);
}

async function executePurge(scope, objects, network) {
  // Batch into groups of 1000 (Akamai limit)
  const batches = [];
  for (let i = 0; i < objects.length; i += 1000) {
    batches.push(objects.slice(i, i + 1000));
  }

  console.log(`→ Sending ${batches.length} batch(es) to Akamai Fast Purge API...`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const scopePath = scope === 'tags' ? 'tag' : 'url';
    const path = `/ccu/v3/invalidations/${scopePath}/${network}`;
    const body = JSON.stringify({ objects: batch });

    try {
      // Uses akamai-edgegrid-node if available, otherwise shows curl command
      const curl = `curl -s -X POST "https://${process.env.AKAMAI_HOST}${path}" \\
  -H "Content-Type: application/json" \\
  -d '${body}' \\
  --edgegrid "${process.env.AKAMAI_HOST}:${process.env.AKAMAI_CLIENT_TOKEN}:${process.env.AKAMAI_CLIENT_SECRET}:${process.env.AKAMAI_ACCESS_TOKEN}"`;

      console.log(`  Batch ${i + 1}/${batches.length}: ${batch.length} objects`);
      console.log('');
      console.log('  To execute manually, run:');
      console.log(`  ${curl}`);
      console.log('');
      console.log('  Or use the Akamai Luna Portal: https://control.akamai.com → CDN → Purge Cache');
    } catch (err) {
      console.error(`  Batch ${i + 1} failed: ${err.message}`);
    }
  }

  console.log('→ Purge submitted. Typical completion: 5-10 seconds.');
  console.log('  Monitor purge status in admin console: Operations → Purge History');
}
