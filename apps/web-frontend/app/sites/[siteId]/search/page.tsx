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
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-6">Search</h1>
      <form action="" className="flex gap-2 mb-8">
        <input name="q" defaultValue={q} placeholder="Search content..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
          Search
        </button>
      </form>
      {results && (
        <div>
          <p className="text-sm text-gray-500 mb-4">{results.total} results for &quot;{q}&quot;</p>
          <div className="space-y-4">
            {results.items.map((item: any) => (
              <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="font-semibold text-gray-900">{item.title}</h2>
                {item.highlights?.body && (
                  <p className="text-sm text-gray-500 mt-1"
                    dangerouslySetInnerHTML={{ __html: item.highlights.body[0] }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
