const API_URL = process.env.CMS_API_URL || 'http://localhost:17000/api/v1';

export async function getContent(siteId: string, contentType: string, slug: string, locale = 'en') {
  const res = await fetch(
    `${API_URL}/content/${siteId}/${contentType}/${slug}?locale=${locale}`,
    { next: { revalidate: 60 } },
  );
  if (!res.ok) return null;
  const data = await res.json();

  // Forward surrogate keys for ISR cache tag invalidation
  return { data, surrogateKey: res.headers.get('Surrogate-Key') || '' };
}

export async function listContent(siteId: string, contentType: string, opts: {
  locale?: string; page?: number; size?: number;
} = {}) {
  const params = new URLSearchParams({
    siteId, contentType,
    locale: opts.locale || 'en',
    page: String(opts.page || 1),
    size: String(opts.size || 20),
  });
  const res = await fetch(`${API_URL}/content?${params}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function searchContent(siteId: string, q: string, opts: {
  contentType?: string; locale?: string; page?: number;
} = {}) {
  const params = new URLSearchParams({ siteId, q, ...opts as Record<string, string> });
  const res = await fetch(`${API_URL}/search?${params}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}
