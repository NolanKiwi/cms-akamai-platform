'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Globe, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Site } from '@/lib/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SiteSettingsForm } from '@/components/site/SiteSettingsForm';

export default function SiteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/sites/${id}`);
      setSite(res.data);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Failed to load site');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  return (
    <>
      <PageHeader
        title={site?.name || (loading ? 'Loading…' : 'Site')}
        description={site ? `Slug: ${site.slug} · Hostname: ${(site as any).hostname || site.domain || '—'}` : undefined}
        breadcrumbs={[
          { label: 'dimi-cms', href: '/dashboard' },
          { label: 'Content Delivery' },
          { label: 'Sites', href: '/sites' },
          { label: site?.name || id || '…' },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </>
        }
      />

      <div className="px-6 py-6">
        {error && (
          <Card className="mb-4">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="cache">Cache</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Globe className="h-4 w-4" /> Identity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Field label="ID" value={site?.id} mono />
                  <Field label="Slug" value={site?.slug} mono />
                  <Field label="Name" value={site?.name} />
                  <Field label="Hostname" value={(site as any)?.hostname || site?.domain || '—'} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Locales</CardTitle>
                </CardHeader>
                <CardContent>
                  {site ? (
                    <div className="flex flex-wrap gap-1.5">
                      {site.locales.map((l) => (
                        <Badge
                          key={l}
                          variant={l === site.defaultLocale ? 'default' : 'muted'}
                          className="font-mono text-xs uppercase"
                        >
                          {l}
                          {l === site.defaultLocale && ' · default'}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">—</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {(site as any)?.isActive === false ? (
                    <Badge variant="muted">Inactive</Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="content" className="pt-6">
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Use the global <a href="/content" className="text-primary hover:underline">Content</a> page filtered by this Site ID.
                Inline content list will land in a future iteration.
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cache" className="pt-6">
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Cache tag scope, hit/miss ratio and recent purges for this site (planned).
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="pt-6">
            {site ? (
              <SiteSettingsForm site={site} onSaved={(s) => setSite(s)} />
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  {loading ? 'Loading site…' : 'Site not loaded.'}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono text-xs' : 'text-sm'}>{value || '—'}</span>
    </div>
  );
}
