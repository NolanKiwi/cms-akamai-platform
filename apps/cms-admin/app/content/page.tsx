'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { ContentEntry, ContentStatus, Paginated } from '@/lib/types';
import { useActiveSite } from '@/lib/active-site';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const STATUS_VARIANT: Record<ContentStatus, BadgeProps['variant']> = {
  published: 'success',
  draft: 'muted',
  in_review: 'warning',
  scheduled: 'default',
  archived: 'destructive',
};

const TYPES = ['page', 'article', 'post', 'product'] as const;

async function fetchContent(
  siteId: string,
  type: string,
): Promise<Paginated<ContentEntry>> {
  const res = await api.get(`/admin/content/${type}?siteId=${siteId}&size=50`);
  return res.data;
}

export default function ContentPage() {
  const [activeSiteId, setActiveSiteId] = useActiveSite();
  const [siteId, setSiteId] = useState('');
  const [type, setType] = useState<string>('page');

  useEffect(() => {
    if (activeSiteId && !siteId) setSiteId(activeSiteId);
  }, [activeSiteId]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['content', activeSiteId, type],
    queryFn: () => fetchContent(activeSiteId, type),
    enabled: !!activeSiteId,
  });

  const loading = isLoading || isFetching;
  const errorMessage = error
    ? (error as any).response?.data?.message || (error as Error).message
    : '';

  return (
    <>
      <PageHeader
        title="Content"
        description="Manage pages, posts, and content entries by site."
        breadcrumbs={[
          { label: 'dimi-cms', href: '/dashboard' },
          { label: 'Content Delivery' },
          { label: 'Content' },
        ]}
        actions={
          <Button asChild size="sm" disabled={!activeSiteId}>
            <Link
              href={`/content/new?siteId=${encodeURIComponent(activeSiteId || '')}&type=${type}`}
            >
              <Plus className="h-4 w-4" />
              New entry
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-4 px-6 py-6">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Input
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              placeholder="Site ID (UUID)"
              className="max-w-sm"
            />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => siteId && setActiveSiteId(siteId)}
              disabled={loading || !siteId}
              size="sm"
            >
              <Search className="h-4 w-4" />
              {loading ? 'Loading…' : 'Load'}
            </Button>
            {data && (
              <span className="ml-auto text-xs text-muted-foreground">
                {data.total} entries · page {data.page}
              </span>
            )}
          </CardContent>
        </Card>

        {errorMessage && (
          <Card>
            <CardContent className="py-4 text-sm text-destructive">{errorMessage}</CardContent>
          </Card>
        )}

        {data && (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Locale</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No content yet for {type}. Create one with “New entry”.
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      <Link href={`/content/${entry.id}`} className="hover:underline">
                        {entry.currentVersion?.title || entry.slug}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.slug}</TableCell>
                    <TableCell className="font-mono text-xs uppercase text-muted-foreground">
                      {entry.locale}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[entry.status] || 'muted'}>{entry.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(entry.updatedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
