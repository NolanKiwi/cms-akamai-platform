// Local CMS API presets (relative to NEXT_PUBLIC_API_URL).

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface CmsPreset {
  group: string;
  label: string;
  method: Method;
  path: string;
  body?: string;
}

export const CMS_PRESETS: CmsPreset[] = [
  { group: 'Health', label: 'GET /health', method: 'GET', path: '/health' },
  { group: 'Health', label: 'GET /ready', method: 'GET', path: '/ready' },
  { group: 'Auth', label: 'GET /auth/me', method: 'GET', path: '/auth/me' },
  { group: 'Sites', label: 'GET /admin/sites', method: 'GET', path: '/admin/sites' },
  { group: 'Sites', label: 'GET /sites', method: 'GET', path: '/sites' },
  { group: 'Content', label: 'GET /admin/content/article', method: 'GET', path: '/admin/content/article' },
  {
    group: 'Content',
    label: 'POST /admin/content/article',
    method: 'POST',
    path: '/admin/content/article',
    body: JSON.stringify(
      {
        siteId: '00000000-0000-0000-0000-000000000000',
        slug: 'hello-world',
        title: 'Hello World',
        body: { ops: [{ insert: 'Hello\n' }] },
      },
      null,
      2,
    ),
  },
  { group: 'Redirects', label: 'GET /admin/redirects', method: 'GET', path: '/admin/redirects' },
  { group: 'Assets', label: 'GET /admin/assets', method: 'GET', path: '/admin/assets' },
  { group: 'Purge', label: 'GET /admin/purge', method: 'GET', path: '/admin/purge' },
  {
    group: 'Purge',
    label: 'POST /admin/purge/tags',
    method: 'POST',
    path: '/admin/purge/tags',
    body: JSON.stringify({ tags: ['site:default'], reason: 'API tester' }, null, 2),
  },
  { group: 'Webhooks', label: 'GET /admin/webhooks', method: 'GET', path: '/admin/webhooks' },
  { group: 'Akamai (proxied)', label: 'GET /admin/akamai/status', method: 'GET', path: '/admin/akamai/status' },
];
