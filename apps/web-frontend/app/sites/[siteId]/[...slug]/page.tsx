import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getContent } from '@/lib/cms';
import type { Metadata } from 'next';

interface Props {
  params: { siteId: string; slug: string[] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await getContent(params.siteId, 'page', params.slug.join('/'));
  if (!result?.data) return {};
  const title = result.data.currentVersion?.title || params.slug.at(-1);
  return { title };
}

export default async function ContentPage({ params }: Props) {
  const slugPath = params.slug.join('/');
  const [contentType, ...rest] = params.slug;
  const slug = rest.join('/') || contentType;

  const result = await getContent(params.siteId, contentType, slug);
  if (!result?.data) notFound();

  const { data, surrogateKey } = result;

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <article>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {data.currentVersion?.title || slugPath}
        </h1>
        {data.publishedAt && (
          <time className="text-sm text-gray-400 block mb-6">
            {new Date(data.publishedAt).toLocaleDateString('ko-KR', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </time>
        )}
        <div className="prose prose-gray max-w-none">
          {typeof data.currentVersion?.fields?.body === 'string' && (
            <div dangerouslySetInnerHTML={{ __html: data.currentVersion.fields.body }} />
          )}
        </div>
      </article>
      {/* Cache tags passed via Surrogate-Key header for Akamai/ISR invalidation */}
      {surrogateKey && (
        <meta name="x-surrogate-key" content={surrogateKey} />
      )}
    </main>
  );
}

// ISR: revalidate every 60 seconds
export const revalidate = 60;
