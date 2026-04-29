// Akamai OPEN API catalog — paths sourced from akamai/akamai-apis OpenAPI specs
// (https://github.com/akamai/akamai-apis). All requests are signed via the
// admin proxy `/admin/akamai/proxy` (EdgeGrid v1) on the server side.
//
// Path placeholders use {curly-braces}; the user fills them in directly in
// the request URL field. Bodies are JSON pre-filled examples.

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface AkamaiPreset {
  group: string;
  product: string; // short product code
  label: string;
  method: Method;
  path: string;
  body?: string;
  doc?: string;
  notes?: string;
}

export const AKAMAI_PRESETS: AkamaiPreset[] = [
  // ─────────────────────────── Property Manager (PAPI) ─────────────────────────
  {
    group: 'Property Manager (PAPI)',
    product: 'papi',
    label: 'List contracts',
    method: 'GET',
    path: '/papi/v1/contracts',
    doc: 'https://techdocs.akamai.com/property-mgr/reference/get-contracts',
  },
  {
    group: 'Property Manager (PAPI)',
    product: 'papi',
    label: 'List groups',
    method: 'GET',
    path: '/papi/v1/groups',
    doc: 'https://techdocs.akamai.com/property-mgr/reference/get-groups',
  },
  {
    group: 'Property Manager (PAPI)',
    product: 'papi',
    label: 'List products',
    method: 'GET',
    path: '/papi/v1/products?contractId={contractId}',
  },
  {
    group: 'Property Manager (PAPI)',
    product: 'papi',
    label: 'List properties (group)',
    method: 'GET',
    path: '/papi/v1/properties?contractId={contractId}&groupId={groupId}',
  },
  {
    group: 'Property Manager (PAPI)',
    product: 'papi',
    label: 'Get property',
    method: 'GET',
    path: '/papi/v1/properties/{propertyId}?contractId={contractId}&groupId={groupId}',
  },
  {
    group: 'Property Manager (PAPI)',
    product: 'papi',
    label: 'List property versions',
    method: 'GET',
    path: '/papi/v1/properties/{propertyId}/versions?contractId={contractId}&groupId={groupId}',
  },
  {
    group: 'Property Manager (PAPI)',
    product: 'papi',
    label: 'Get property rule tree',
    method: 'GET',
    path: '/papi/v1/properties/{propertyId}/versions/{ver}/rules?contractId={contractId}&groupId={groupId}',
  },
  {
    group: 'Property Manager (PAPI)',
    product: 'papi',
    label: 'List hostnames',
    method: 'GET',
    path: '/papi/v1/properties/{propertyId}/versions/{ver}/hostnames?contractId={contractId}&groupId={groupId}',
  },
  {
    group: 'Property Manager (PAPI)',
    product: 'papi',
    label: 'List activations',
    method: 'GET',
    path: '/papi/v1/properties/{propertyId}/activations?contractId={contractId}&groupId={groupId}',
  },
  {
    group: 'Property Manager (PAPI)',
    product: 'papi',
    label: 'Search by value',
    method: 'POST',
    path: '/papi/v1/search/find-by-value',
    body: JSON.stringify({ hostname: 'example.com' }, null, 2),
  },
  {
    group: 'Property Manager (PAPI)',
    product: 'papi',
    label: 'List edge hostnames',
    method: 'GET',
    path: '/papi/v1/edgehostnames?contractId={contractId}&groupId={groupId}',
  },
  {
    group: 'Property Manager (PAPI)',
    product: 'papi',
    label: 'Build account',
    method: 'GET',
    path: '/papi/v1/build-account',
  },

  // ─────────────────────────── CCU / Fast Purge ────────────────────────────────
  {
    group: 'Fast Purge (CCU v3)',
    product: 'ccu',
    label: 'Invalidate by URL (staging)',
    method: 'POST',
    path: '/ccu/v3/invalidate/url/staging',
    body: JSON.stringify({ objects: ['https://www.example.com/'] }, null, 2),
  },
  {
    group: 'Fast Purge (CCU v3)',
    product: 'ccu',
    label: 'Invalidate by URL (production)',
    method: 'POST',
    path: '/ccu/v3/invalidate/url/production',
    body: JSON.stringify({ objects: ['https://www.example.com/'] }, null, 2),
  },
  {
    group: 'Fast Purge (CCU v3)',
    product: 'ccu',
    label: 'Invalidate by tag',
    method: 'POST',
    path: '/ccu/v3/invalidate/tag/production',
    body: JSON.stringify({ objects: ['site:default'] }, null, 2),
  },
  {
    group: 'Fast Purge (CCU v3)',
    product: 'ccu',
    label: 'Invalidate by CP code',
    method: 'POST',
    path: '/ccu/v3/invalidate/cpcode/production',
    body: JSON.stringify({ objects: [123456] }, null, 2),
  },
  {
    group: 'Fast Purge (CCU v3)',
    product: 'ccu',
    label: 'Delete by URL (production)',
    method: 'POST',
    path: '/ccu/v3/delete/url/production',
    body: JSON.stringify({ objects: ['https://www.example.com/old'] }, null, 2),
  },

  // ─────────────────────────── Reporting v1 / v2 ───────────────────────────────
  {
    group: 'Reporting',
    product: 'reporting',
    label: 'List reports (v2)',
    method: 'GET',
    path: '/reporting-api/v2/reports',
  },
  {
    group: 'Reporting',
    product: 'reporting',
    label: 'List reports (v1)',
    method: 'GET',
    path: '/reporting-api/v1/reports',
  },
  {
    group: 'Reporting',
    product: 'reporting',
    label: 'Run hits-by-cpcode (v2)',
    method: 'POST',
    path: '/reporting-api/v2/reports/delivery/traffic/current/data',
    body: JSON.stringify(
      {
        dimensions: ['cpcode'],
        metrics: ['edgeHitsTotal', 'originHitsTotal'],
        filters: [],
        start: '2026-04-22T00:00:00Z',
        end: '2026-04-29T00:00:00Z',
        interval: 'HOUR',
      },
      null,
      2,
    ),
  },

  // ─────────────────────────── EdgeWorkers ─────────────────────────────────────
  {
    group: 'EdgeWorkers',
    product: 'edgeworkers',
    label: 'List EdgeWorker IDs',
    method: 'GET',
    path: '/edgeworkers/v1/ids',
  },
  {
    group: 'EdgeWorkers',
    product: 'edgeworkers',
    label: 'List versions',
    method: 'GET',
    path: '/edgeworkers/v1/ids/{ewId}/versions',
  },
  {
    group: 'EdgeWorkers',
    product: 'edgeworkers',
    label: 'List activations',
    method: 'GET',
    path: '/edgeworkers/v1/ids/{ewId}/activations',
  },
  {
    group: 'EdgeWorkers',
    product: 'edgeworkers',
    label: 'Activate version',
    method: 'POST',
    path: '/edgeworkers/v1/ids/{ewId}/activations',
    body: JSON.stringify({ network: 'STAGING', version: '1.0' }, null, 2),
  },
  {
    group: 'EdgeWorkers',
    product: 'edgeworkers',
    label: 'List resource tiers',
    method: 'GET',
    path: '/edgeworkers/v1/resource-tiers',
  },

  // ─────────────────────────── EdgeKV ──────────────────────────────────────────
  {
    group: 'EdgeKV',
    product: 'edgekv',
    label: 'Initialize',
    method: 'PUT',
    path: '/edgekv/v1/initialize',
  },
  {
    group: 'EdgeKV',
    product: 'edgekv',
    label: 'List namespaces',
    method: 'GET',
    path: '/edgekv/v1/networks/staging/namespaces',
  },
  {
    group: 'EdgeKV',
    product: 'edgekv',
    label: 'Read item',
    method: 'GET',
    path: '/edgekv/v1/networks/staging/namespaces/{ns}/groups/{group}/items/{key}',
  },
  {
    group: 'EdgeKV',
    product: 'edgekv',
    label: 'Write item',
    method: 'PUT',
    path: '/edgekv/v1/networks/staging/namespaces/{ns}/groups/{group}/items/{key}',
    body: JSON.stringify({ value: 'hello' }, null, 2),
  },
  {
    group: 'EdgeKV',
    product: 'edgekv',
    label: 'Delete item',
    method: 'DELETE',
    path: '/edgekv/v1/networks/staging/namespaces/{ns}/groups/{group}/items/{key}',
  },

  // ─────────────────────────── Edge DNS ────────────────────────────────────────
  {
    group: 'Edge DNS',
    product: 'config-dns',
    label: 'List zones',
    method: 'GET',
    path: '/config-dns/v2/zones',
  },
  {
    group: 'Edge DNS',
    product: 'config-dns',
    label: 'Get zone',
    method: 'GET',
    path: '/config-dns/v2/zones/{zone}',
  },
  {
    group: 'Edge DNS',
    product: 'config-dns',
    label: 'List record sets',
    method: 'GET',
    path: '/config-dns/v2/zones/{zone}/recordsets',
  },
  {
    group: 'Edge DNS',
    product: 'config-dns',
    label: 'Get DNSSEC',
    method: 'GET',
    path: '/config-dns/v2/zones/{zone}/dns-sec-status',
  },

  // ─────────────────────────── GTM ─────────────────────────────────────────────
  {
    group: 'Global Traffic Management',
    product: 'config-gtm',
    label: 'List domains',
    method: 'GET',
    path: '/config-gtm/v1/domains',
  },
  {
    group: 'Global Traffic Management',
    product: 'config-gtm',
    label: 'Get domain',
    method: 'GET',
    path: '/config-gtm/v1/domains/{domain}',
  },
  {
    group: 'Global Traffic Management',
    product: 'config-gtm',
    label: 'List properties',
    method: 'GET',
    path: '/config-gtm/v1/domains/{domain}/properties',
  },

  // ─────────────────────────── CPS (Certificates) ──────────────────────────────
  {
    group: 'Certificate Provisioning (CPS)',
    product: 'cps',
    label: 'List enrollments',
    method: 'GET',
    path: '/cps/v2/enrollments?contractId={contractId}',
  },
  {
    group: 'Certificate Provisioning (CPS)',
    product: 'cps',
    label: 'Get enrollment',
    method: 'GET',
    path: '/cps/v2/enrollments/{enrollmentId}',
  },
  {
    group: 'Certificate Provisioning (CPS)',
    product: 'cps',
    label: 'List deployments',
    method: 'GET',
    path: '/cps/v2/enrollments/{enrollmentId}/deployments',
  },
  {
    group: 'Certificate Provisioning (CPS)',
    product: 'cps',
    label: 'Get DV history',
    method: 'GET',
    path: '/cps/v2/enrollments/{enrollmentId}/dv-history',
  },

  // ─────────────────────────── CP Codes / Reporting Groups ─────────────────────
  {
    group: 'CP Codes & Reporting Groups (CPRG)',
    product: 'cprg',
    label: 'List CP codes',
    method: 'GET',
    path: '/cprg/v1/cpcodes',
  },
  {
    group: 'CP Codes & Reporting Groups (CPRG)',
    product: 'cprg',
    label: 'Get CP code',
    method: 'GET',
    path: '/cprg/v1/cpcodes/{cpcodeId}',
  },
  {
    group: 'CP Codes & Reporting Groups (CPRG)',
    product: 'cprg',
    label: 'List reporting groups',
    method: 'GET',
    path: '/cprg/v1/reporting-groups',
  },

  // ─────────────────────────── Identity & Access (IAM) ─────────────────────────
  {
    group: 'Identity & Access (IAM)',
    product: 'identity-management',
    label: 'List users',
    method: 'GET',
    path: '/identity-management/v3/user-admin/ui-identities',
  },
  {
    group: 'Identity & Access (IAM)',
    product: 'identity-management',
    label: 'Get profile',
    method: 'GET',
    path: '/identity-management/v3/user-profile',
  },
  {
    group: 'Identity & Access (IAM)',
    product: 'identity-management',
    label: 'List API clients',
    method: 'GET',
    path: '/identity-management/v3/api-clients',
  },
  {
    group: 'Identity & Access (IAM)',
    product: 'identity-management',
    label: 'List groups',
    method: 'GET',
    path: '/identity-management/v3/user-admin/groups',
  },
  {
    group: 'Identity & Access (IAM)',
    product: 'identity-management',
    label: 'List roles',
    method: 'GET',
    path: '/identity-management/v3/user-admin/roles',
  },

  // ─────────────────────────── Network Lists ───────────────────────────────────
  {
    group: 'Network Lists',
    product: 'network-list',
    label: 'List network lists',
    method: 'GET',
    path: '/network-list/v2/network-lists',
  },
  {
    group: 'Network Lists',
    product: 'network-list',
    label: 'Get network list',
    method: 'GET',
    path: '/network-list/v2/network-lists/{listId}?includeElements=true',
  },
  {
    group: 'Network Lists',
    product: 'network-list',
    label: 'Append elements',
    method: 'POST',
    path: '/network-list/v2/network-lists/{listId}/append',
    body: JSON.stringify({ list: ['203.0.113.10', '203.0.113.11'] }, null, 2),
  },
  {
    group: 'Network Lists',
    product: 'network-list',
    label: 'Activate (staging)',
    method: 'POST',
    path: '/network-list/v2/network-lists/{listId}/environments/STAGING/activate',
    body: JSON.stringify({ comments: 'tester', notificationRecipients: [] }, null, 2),
  },

  // ─────────────────────────── Site Shield ─────────────────────────────────────
  {
    group: 'Site Shield',
    product: 'siteshield',
    label: 'List maps',
    method: 'GET',
    path: '/siteshield/v1/maps',
  },
  {
    group: 'Site Shield',
    product: 'siteshield',
    label: 'Get map',
    method: 'GET',
    path: '/siteshield/v1/maps/{mapId}',
  },
  {
    group: 'Site Shield',
    product: 'siteshield',
    label: 'Acknowledge map',
    method: 'POST',
    path: '/siteshield/v1/maps/{mapId}/acknowledge',
  },

  // ─────────────────────────── App & API Protector / Bot Manager ───────────────
  {
    group: 'App & API Protector',
    product: 'appsec',
    label: 'List configurations',
    method: 'GET',
    path: '/appsec/v1/configs',
  },
  {
    group: 'App & API Protector',
    product: 'appsec',
    label: 'Get config version',
    method: 'GET',
    path: '/appsec/v1/configs/{configId}/versions/{ver}',
  },
  {
    group: 'App & API Protector',
    product: 'appsec',
    label: 'List policies',
    method: 'GET',
    path: '/appsec/v1/configs/{configId}/versions/{ver}/security-policies',
  },
  {
    group: 'App & API Protector',
    product: 'appsec',
    label: 'List rate policies',
    method: 'GET',
    path: '/appsec/v1/configs/{configId}/versions/{ver}/rate-policies',
  },
  {
    group: 'App & API Protector',
    product: 'appsec',
    label: 'List custom rules',
    method: 'GET',
    path: '/appsec/v1/configs/{configId}/versions/{ver}/custom-rules',
  },

  // ─────────────────────────── DataStream 2 ────────────────────────────────────
  {
    group: 'DataStream 2',
    product: 'datastream-config-api',
    label: 'List streams',
    method: 'GET',
    path: '/datastream-config-api/v2/log/streams',
  },
  {
    group: 'DataStream 2',
    product: 'datastream-config-api',
    label: 'Get stream',
    method: 'GET',
    path: '/datastream-config-api/v2/log/streams/{streamId}',
  },
  {
    group: 'DataStream 2',
    product: 'datastream-config-api',
    label: 'Activate stream',
    method: 'POST',
    path: '/datastream-config-api/v2/log/streams/{streamId}/activate',
  },

  // ─────────────────────────── Image & Video Manager ───────────────────────────
  {
    group: 'Image & Video Manager (IVM)',
    product: 'imaging',
    label: 'List image policies (staging)',
    method: 'GET',
    path: '/imaging/v2/network/staging/policies/image',
  },
  {
    group: 'Image & Video Manager (IVM)',
    product: 'imaging',
    label: 'Get image policy',
    method: 'GET',
    path: '/imaging/v2/network/staging/policies/image/{policyId}',
  },
  {
    group: 'Image & Video Manager (IVM)',
    product: 'imaging',
    label: 'List policy sets',
    method: 'GET',
    path: '/imaging/v2/policysets',
  },

  // ─────────────────────────── Adaptive Media Delivery (AMD) ───────────────────
  {
    group: 'Adaptive Media Delivery (AMD)',
    product: 'amd',
    label: 'List policies',
    method: 'GET',
    path: '/amd/v1/policies',
  },

  // ─────────────────────────── Diagnostic Tools ────────────────────────────────
  {
    group: 'Diagnostic Tools',
    product: 'diagnostic-tools',
    label: 'Locations',
    method: 'GET',
    path: '/diagnostic-tools/v2/ghost-locations/available',
  },
  {
    group: 'Diagnostic Tools',
    product: 'diagnostic-tools',
    label: 'Edge IPs (CIDR)',
    method: 'GET',
    path: '/diagnostic-tools/v2/edge-ip',
  },
  {
    group: 'Diagnostic Tools',
    product: 'diagnostic-tools',
    label: 'Translated URL',
    method: 'GET',
    path: '/diagnostic-tools/v2/translated-url?url=https://www.example.com/',
  },
  {
    group: 'Diagnostic Tools',
    product: 'diagnostic-tools',
    label: 'GREP request from logs',
    method: 'POST',
    path: '/diagnostic-tools/v2/grep',
    body: JSON.stringify({ cpCodes: ['123456'], start: '2026-04-29T00:00:00Z', end: '2026-04-29T01:00:00Z' }, null, 2),
  },

  // ─────────────────────────── Cloudlets ───────────────────────────────────────
  {
    group: 'Cloudlets',
    product: 'cloudlets',
    label: 'List policies (v3)',
    method: 'GET',
    path: '/cloudlets/v3/policies',
  },
  {
    group: 'Cloudlets',
    product: 'cloudlets',
    label: 'List shared policies',
    method: 'GET',
    path: '/cloudlets/api/v2/policies',
  },

  // ─────────────────────────── Test Center ─────────────────────────────────────
  {
    group: 'Test Center',
    product: 'test-management',
    label: 'List test suites',
    method: 'GET',
    path: '/test-management/v3/functional/test-suites',
  },
  {
    group: 'Test Center',
    product: 'test-management',
    label: 'List configs',
    method: 'GET',
    path: '/test-management/v3/functional/configs',
  },

  // ─────────────────────────── Account Switching ───────────────────────────────
  {
    group: 'Account Switching',
    product: 'identity-management',
    label: 'Search accounts',
    method: 'GET',
    path: '/identity-management/v3/api-clients/self/account-switch-keys?search=acme',
  },
];

export const AKAMAI_GROUPS = Array.from(new Set(AKAMAI_PRESETS.map((p) => p.group)));
