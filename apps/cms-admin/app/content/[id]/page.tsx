'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ContentEntry } from '@/lib/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { ContentEditor } from '@/components/content/ContentEditor';
import { ContentWorkflowBar } from '@/components/content/ContentWorkflowBar';

async function fetchEntry(id: string): Promise<ContentEntry | null> {
  // The admin route requires a content type prefix. We don't know it up-front,
  // so try the common types in order until one resolves.
  for (const type of ['page', 'article', 'post', 'product']) {
    try {
      const r = await api.get(`/admin/content/${type}/${id}`);
      if (r.data?.id) return r.data;
    } catch (e: any) {
      if (e?.response?.status && e.response.status >= 500) throw e;
    }
  }
  return null;
}

export default function ContentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['content-entry', id],
    queryFn: () => fetchEntry(id!),
    enabled: !!id,
  });

  return (
    <>
      <PageHeader
        title={data?.currentVersion?.title || data?.slug || 'Content'}
        description={
          data
            ? `${data.contentType} · ${data.locale} · v${data.currentVersion?.versionNumber || '?'}`
            : 'Loading entry'
        }
        breadcrumbs={[
          { label: 'dimi-cms', href: '/dashboard' },
          { label: 'Content Delivery' },
          { label: 'Content', href: '/content' },
          { label: data?.slug || id || '…' },
        ]}
      />
      <div className="space-y-4 px-6 py-6">
        {error && (
          <Card>
            <CardContent className="py-4 text-sm text-destructive">
              {(error as any).response?.data?.message || (error as Error).message}
            </CardContent>
          </Card>
        )}
        {isLoading && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Loading…
            </CardContent>
          </Card>
        )}
        {!isLoading && !data && !error && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Not found.
            </CardContent>
          </Card>
        )}
        {data && (
          <>
            <ContentWorkflowBar entry={data} />
            <ContentEditor entry={data} />
          </>
        )}
      </div>
    </>
  );
}
