import DOMPurify from 'isomorphic-dompurify';
import { searchContent } from '@/lib/cms';

interface Props {
  params: { siteId: string };
  searchParams: { q?: string; page?: string };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const q = searchParams.q || '';
  const page = +(searchParams.page || 1);
  const results = q ? await searchContent(params.siteId, q, { page }) : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Search</h1>
      <form action="" className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search content…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Search
        </button>
      </form>

      {results && (
        <div className="mt-8 space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {results.total} results for &ldquo;{q}&rdquo;
          </p>
          {results.items.map((item: any) => (
            <article
              key={item.id}
              className="rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <h2 className="font-medium text-foreground">{item.title}</h2>
              {item.highlights?.body && (
                <p
                  className="mt-1 text-sm text-muted-foreground"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(item.highlights.body[0], {
                      ALLOWED_TAGS: ['em', 'strong', 'mark', 'b', 'i'],
                      ALLOWED_ATTR: [],
                    }),
                  }}
                />
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
