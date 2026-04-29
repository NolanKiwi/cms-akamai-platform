#!/usr/bin/env node
//
// dimi-cms — direct Akamai OPEN API caller.
//
// Reads credentials from the repo root .env (AKAMAI_HOST/CLIENT_TOKEN/
// CLIENT_SECRET/ACCESS_TOKEN) and signs requests with the official
// `akamai-edgegrid` SDK that's already installed in node_modules.
//
// Usage:
//   node scripts/akamai-call.js <METHOD> <PATH> [BODY_JSON]
//
// Examples:
//   node scripts/akamai-call.js GET /cprg/v1/cpcodes
//   node scripts/akamai-call.js GET /cprg/v1/cpcodes/1129412
//   node scripts/akamai-call.js GET /papi/v1/groups
//   node scripts/akamai-call.js GET '/papi/v1/properties?contractId=ctr_1-3CV382&groupId=grp_18432'
//   node scripts/akamai-call.js POST /papi/v1/search/find-by-value '{"propertyName":"www.example.com_pm"}'
//   node scripts/akamai-call.js POST \
//     '/reporting-api/v2/reports/delivery/traffic/current/data?start=2026-04-26T00:00:00Z&end=2026-04-27T00:00:00Z' \
//     '{"metrics":["edgeHitsSum","edgeBytesSum"],"dimensions":["cpcode","time1day"],"limit":10}'
//
// Output: response body verbatim on stdout (JSON if Akamai returns JSON).
// Pipe to jq for shaping. Non-2xx responses go to stderr and exit 1.
//
const path = require('path');
const fs = require('fs');

// Load .env from the repo root (one directory above scripts/)
const REPO_ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(REPO_ROOT, '.env');
try {
  require(path.join(REPO_ROOT, 'node_modules', 'dotenv')).config({ path: ENV_PATH });
} catch (e) {
  // Fallback minimal parser if dotenv isn't there for some reason
  if (fs.existsSync(ENV_PATH)) {
    for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        let v = m[2];
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  }
}

let EdgeGrid;
try {
  EdgeGrid = require(path.join(REPO_ROOT, 'node_modules', 'akamai-edgegrid'));
} catch (e) {
  console.error(
    'akamai-edgegrid not found in node_modules. Run `npm install` from repo root first.',
  );
  process.exit(1);
}

const [, , method = 'GET', urlPath, bodyArg] = process.argv;
if (!urlPath) {
  console.error(
    'Usage: node scripts/akamai-call.js <METHOD> <PATH> [BODY_JSON]\n' +
      'Try:   node scripts/akamai-call.js GET /cprg/v1/cpcodes',
  );
  process.exit(2);
}

const required = ['AKAMAI_HOST', 'AKAMAI_CLIENT_TOKEN', 'AKAMAI_CLIENT_SECRET', 'AKAMAI_ACCESS_TOKEN'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(', ')}`);
  process.exit(2);
}

const M = method.toUpperCase();
const eg = new EdgeGrid(
  process.env.AKAMAI_CLIENT_TOKEN,
  process.env.AKAMAI_CLIENT_SECRET,
  process.env.AKAMAI_ACCESS_TOKEN,
  `https://${process.env.AKAMAI_HOST}`,
);

const headers = { 'content-type': 'application/json', accept: 'application/json' };
let body;
if (bodyArg) {
  // Accept either a JSON string or a path to a JSON file
  if (fs.existsSync(bodyArg)) body = fs.readFileSync(bodyArg, 'utf8');
  else body = bodyArg;
  // Validate JSON shape early so SDK doesn't get garbage
  try {
    JSON.parse(body);
  } catch {
    console.error('Body argument is not valid JSON.');
    process.exit(2);
  }
}

eg.auth({ path: urlPath, method: M, headers, body });
eg.send(function (err, response, responseBody) {
  if (err) {
    var er = err && err.response;
    var status = (er && er.status) || '';
    var data = er && er.data;
    process.stderr.write(
      'Akamai ' + status + ': ' +
      (typeof data === 'string' ? data : JSON.stringify(data || err.message)) + '\n',
    );
    process.exit(1);
  }
  var status =
    (response && (response.status != null ? response.status : response.statusCode)) || 0;
  if (status && (status < 200 || status >= 300)) {
    process.stderr.write('Akamai ' + status + ': ' + responseBody + '\n');
    process.exit(1);
  }
  if (typeof responseBody === 'string') process.stdout.write(responseBody + '\n');
  else process.stdout.write(JSON.stringify((response && response.data) || responseBody) + '\n');
});
