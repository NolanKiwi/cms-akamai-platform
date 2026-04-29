'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContentEditor } from '@/components/content/ContentEditor';
import { useActiveSite } from '@/lib/active-site';

export const dynamic = 'force-dynamic';

function NewContentInner() {
  const params = useSearchParams();
  const [activeSiteId] = useActiveSite();
  const siteId = params.get('siteId') || activeSiteId || '';
  const type = params.get('type') || 'page';

  return (
    <>
      <PageHeader
        title="New content"
        description="Create a new content entry. Saved as a draft until you publish."
        breadcrumbs={[
          { label: 'dimi-cms', href: '/dashboard' },
          { label: 'Content Delivery' },
          { label: 'Content', href: '/content' },
          { label: 'New' },
        ]}
      />
      <div className="px-6 py-6">
        <ContentEditor defaultSiteId={siteId} defaultType={type} />
      </div>
    </>
  );
}

export default function NewContentPage() {
  return (
    <Suspense fallback={<div className="px-6 py-6 text-sm text-muted-foreground">Loading…</div>}>
      <NewContentInner />
    </Suspense>
  );
}
