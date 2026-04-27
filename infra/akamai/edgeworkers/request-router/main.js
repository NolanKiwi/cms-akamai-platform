/**
 * EdgeWorker: Request Router
 *
 * Responsibilities:
 * 1. Check EdgeKV for redirect rules and serve 301/302 directly from edge
 * 2. Check maintenance mode flag in EdgeKV
 * 3. Normalize locale for cache key diversification
 * 4. Normalize device group for cache key diversification
 * 5. Check geo-block list for blocked countries
 *
 * EdgeKV namespaces and groups required:
 *   Namespace: cms-config
 *     Group: redirects        → path → JSON {location, status}
 *     Group: maintenance      → 'maintenance-mode' → 'true' | 'false'
 *     Group: geo-blocks       → 'COUNTRY_CODE' → 'blocked'
 *     Group: feature-flags    → flag-name → 'true' | 'false'
 */

import { EdgeKV } from './edgekv.js';
import { logger } from 'log';

const NAMESPACE = 'cms-config';
const SUPPORTED_LOCALES = ['en', 'fr', 'de', 'es', 'ja', 'zh', 'ko', 'pt', 'ar', 'nl', 'it'];
const DEFAULT_LOCALE = 'en';
const MAINTENANCE_PAGE = '/errors/maintenance.html';

export async function onClientRequest(request) {
  const ekv = new EdgeKV({ namespace: NAMESPACE, group: 'redirects' });

  try {
    // 1. Maintenance mode check (fast path)
    const maintEkv = new EdgeKV({ namespace: NAMESPACE, group: 'maintenance' });
    const maintenance = await maintEkv.getText({ item: 'maintenance-mode' });
    if (maintenance === 'true') {
      request.respondWith(503, {
        'Content-Type': 'text/html',
        'Retry-After': '300',
        'Cache-Control': 'no-store',
      }, '<html><body><h1>Service Temporarily Unavailable</h1><p>We are back shortly.</p></body></html>');
      return;
    }

    // 2. Geo block check
    const country = request.getHeader('X-Forwarded-For-Country') ||
                    request.getHeader('X-Akamai-Edgescape')?.match(/country_code=([A-Z]{2})/)?.[1];
    if (country) {
      const geoEkv = new EdgeKV({ namespace: NAMESPACE, group: 'geo-blocks' });
      const blocked = await geoEkv.getText({ item: country });
      if (blocked === 'blocked') {
        request.respondWith(403, { 'Content-Type': 'application/json' },
          JSON.stringify({ error: 'Content not available in your region' }));
        return;
      }
    }

    // 3. Redirect lookup
    const path = request.url;
    const redirect = await ekv.getText({ item: encodeURIComponent(path) });
    if (redirect) {
      const { location, status = 301 } = JSON.parse(redirect);
      request.respondWith(status, { 'Location': location, 'Cache-Control': 'max-age=3600' }, '');
      return;
    }

    // 4. Locale normalization → stored in PMUSER variable for cache key
    const acceptLang = request.getHeader('Accept-Language') || 'en';
    const locale = normalizeLocale(acceptLang);
    request.setVariable('PMUSER_LOCALE', locale);

    // 5. Device group (already set by Akamai device detection, normalize to 3 buckets)
    const deviceType = request.getVariable('PMUSER_DEVICE_TYPE') || 'desktop';
    const deviceBucket = deviceType.toLowerCase().includes('mobile') ? 'mobile'
                       : deviceType.toLowerCase().includes('tablet') ? 'tablet'
                       : 'desktop';
    request.setVariable('PMUSER_DEVICE_BUCKET', deviceBucket);

  } catch (err) {
    // Non-blocking: if EdgeKV fails, allow request to proceed to origin normally
    logger.log(`EdgeWorker error (non-blocking): ${err.message}`);
  }
}

export function onClientResponse(request, response) {
  // Add trace header for debugging (remove in production if not needed)
  if (process.env.DEBUG_MODE === 'true') {
    response.setHeader('X-EW-Locale', request.getVariable('PMUSER_LOCALE') || 'none');
    response.setHeader('X-EW-Device', request.getVariable('PMUSER_DEVICE_BUCKET') || 'none');
  }
}

/**
 * Normalize Accept-Language header to a supported locale bucket.
 * 'en-US,en;q=0.9,fr;q=0.8' → 'en'
 * 'fr-CA,fr;q=0.9' → 'fr'
 * 'xx-YY' → 'en' (fallback)
 */
function normalizeLocale(acceptLanguage) {
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [tag, q = 'q=1.0'] = lang.trim().split(';');
      const quality = parseFloat(q.split('=')[1] || '1.0');
      const primary = tag.trim().substring(0, 2).toLowerCase();
      return { primary, quality };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { primary } of languages) {
    if (SUPPORTED_LOCALES.includes(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
