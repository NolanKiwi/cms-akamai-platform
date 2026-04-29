'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useActiveSite } from '@/lib/active-site';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  failureCount: number;
}

async function fetchWebhooks(siteId: string): Promise<Webhook[]> {
  const res = await api.get(`/admin/webhooks?siteId=${siteId}`);
  return Array.isArray(res.data) ? res.data : res.data?.items ?? [];
}

export default function WebhooksPage() {
  const [activeSiteId, setActiveSiteId] = useActiveSite();
  const [siteId, setSiteId] = useState('');
  useEffect(() => {
    if (activeSiteId && !siteId) setSiteId(activeSiteId);
  }, [activeSiteId]);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');

  const qc = useQueryClient();
  const toast = useToast();

  const { data = [], isFetching, error } = useQuery({
    queryKey: ['webhooks', activeSiteId],
    queryFn: () => fetchWebhooks(activeSiteId),
    enabled: !!activeSiteId,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post('/admin/webhooks', {
        siteId: activeSiteId,
        url,
        secret,
        events: ['content.published', 'content.unpublished'],
      }),
    onSuccess: () => {
      setUrl('');
      setSecret('');
      qc.invalidateQueries({ queryKey: ['webhooks', activeSiteId] });
      toast.success('Webhook created');
    },
    onError: (err: any) =>
      toast.error('Failed to create webhook', err.response?.data?.message || err.message),
  });

  const errorMessage = error
    ? (error as any).response?.data?.message || (error as Error).message
    : '';

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Outbound webhooks for content lifecycle events. HMAC-signed with the configured secret."
        breadcrumbs={[
          { label: 'dimi-cms', href: '/dashboard' },
          { label: 'Operations' },
          { label: 'Webhooks' },
        ]}
      />

      <div className="flex max-w-5xl flex-col gap-4 px-6 py-6">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Input
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              placeholder="Site ID (UUID)"
              className="max-w-sm"
            />
            <Button onClick={() => siteId && setActiveSiteId(siteId)} disabled={!siteId || isFetching} size="sm">
              <Search className="h-4 w-4" />
              Load
            </Button>
            {data.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">{data.length} webhooks</span>
            )}
          </CardContent>
        </Card>

        {errorMessage && (
          <Card>
            <CardContent className="py-4 text-sm text-destructive">{errorMessage}</CardContent>
          </Card>
        )}

        {activeSiteId && (
          <Card>
            <CardHeader>
              <CardTitle>Add webhook</CardTitle>
              <p className="text-xs text-muted-foreground">
                Subscribed to <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">content.published</code> and{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">content.unpublished</code>.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="min-w-64 flex-1"
              />
              <Input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Signing secret"
                className="w-56"
              />
              <Button onClick={() => create.mutate()} disabled={!url || create.isPending} size="sm">
                <Plus className="h-4 w-4" />
                {create.isPending ? 'Creating…' : 'Create'}
              </Button>
            </CardContent>
          </Card>
        )}

        {data.length > 0 && (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Failures</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="max-w-xs truncate font-mono text-xs">{w.url}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(w.events || []).map((e) => (
                          <Badge key={e} variant="muted" className="text-[0.65rem]">
                            {e}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {w.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Off</Badge>}
                    </TableCell>
                    <TableCell>
                      {w.failureCount > 0 ? (
                        <Badge variant="destructive">{w.failureCount}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
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
