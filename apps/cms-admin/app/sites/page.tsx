'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import type { Site } from '@/lib/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateSiteSheet } from '@/components/site/CreateSiteSheet';
import { AkamaiPropertiesPanel } from '@/components/site/AkamaiPropertiesPanel';

async function fetchSites(): Promise<Site[]> {
  const res = await api.get('/admin/sites');
  return Array.isArray(res.data) ? res.data : res.data?.items ?? [];
}

export default function SitesPage() {
  const [filter, setFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const { data: sites, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['sites'],
    queryFn: fetchSites,
  });

  const loading = isLoading || isFetching;
  const errorMessage = error
    ? (error as any).response?.data?.message || (error as Error).message
    : '';

  const filtered = (sites || []).filter((s) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.slug?.toLowerCase().includes(q) ||
      s.domain?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <PageHeader
        title="Sites"
        description="Multi-site (property) management. Each site has its own locales, hostname and cache scope."
        breadcrumbs={[
          { label: 'dimi-cms', href: '/dashboard' },
          { label: 'Content Delivery' },
          { label: 'Sites' },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
              <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New site
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4 px-6 py-6">
        <div className="flex items-center gap-3">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name, slug, or domain"
            className="max-w-sm"
          />
          <span className="text-xs text-muted-foreground">
            {sites ? `${filtered.length} / ${sites.length}` : '…'}
          </span>
        </div>

        {errorMessage && (
          <Card>
            <CardContent className="py-4 text-sm text-destructive">{errorMessage}</CardContent>
          </Card>
        )}

        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Hostname</TableHead>
                <TableHead>Locales</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !sites && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Loading sites…
                  </TableCell>
                </TableRow>
              )}
              {sites && filtered.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No sites found. Create one via{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">POST /admin/sites</code>.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link href={`/sites/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.slug}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(s as any).hostname || s.domain || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(s.locales || []).map((l) => (
                        <Badge
                          key={l}
                          variant={l === s.defaultLocale ? 'default' : 'muted'}
                          className="font-mono text-[0.65rem] uppercase"
                        >
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(s as any).isActive === false ? (
                      <Badge variant="muted">Inactive</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="icon" variant="ghost" aria-label="Open site">
                      <Link href={`/sites/${s.id}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <AkamaiPropertiesPanel user="gdimitri" />
      </div>

      <CreateSiteSheet open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
