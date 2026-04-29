import { notFound } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';
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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <article>
        <div className="mb-6 text-xs font-medium uppercase tracking-[0.18em] text-primary">
          {contentType}
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
          {data.currentVersion?.title || slugPath}
        </h1>
        {data.publishedAt && (
          <time className="mt-4 block text-sm text-muted-foreground">
            {new Date(data.publishedAt).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        )}
        <div className="mt-8 border-t border-border pt-8 text-foreground/90">
          {typeof data.currentVersion?.fields?.body === 'string' && (
            <div
              className="prose prose-neutral max-w-none prose-headings:tracking-tight prose-a:text-primary"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(data.currentVersion.fields.body, {
                  USE_PROFILES: { html: true },
                }),
              }}
            />
          )}
        </div>
      </article>
      {surrogateKey && <meta name="x-surrogate-key" content={surrogateKey} />}
    </main>
  );
}

export const revalidate = 60;
