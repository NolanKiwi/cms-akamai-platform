'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useActiveSite } from '@/lib/active-site';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Redirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  isActive: boolean;
}

interface RedirectListResponse {
  items: Redirect[];
  total: number;
}

async function fetchRedirects(siteId: string): Promise<RedirectListResponse> {
  const res = await api.get(`/admin/redirects?siteId=${siteId}&size=100`);
  return res.data;
}

export default function RedirectsPage() {
  const [activeSiteId, setActiveSiteId] = useActiveSite();
  const [siteId, setSiteId] = useState('');
  useEffect(() => {
    if (activeSiteId && !siteId) setSiteId(activeSiteId);
  }, [activeSiteId]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('301');

  const qc = useQueryClient();
  const toast = useToast();

  const { data, isFetching, error } = useQuery({
    queryKey: ['redirects', activeSiteId],
    queryFn: () => fetchRedirects(activeSiteId),
    enabled: !!activeSiteId,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post('/admin/redirects', {
        siteId: activeSiteId,
        fromPath: from,
        toPath: to,
        statusCode: +status,
      }),
    onSuccess: () => {
      setFrom('');
      setTo('');
      qc.invalidateQueries({ queryKey: ['redirects', activeSiteId] });
      toast.success('Redirect added');
    },
    onError: (err: any) =>
      toast.error('Failed to add redirect', err.response?.data?.message || err.message),
  });

  const remove = useMutation<unknown, any, string, { previous?: RedirectListResponse }>({
    mutationFn: (id: string) => api.delete(`/admin/redirects/${id}`),
    onMutate: async (id) => {
      const key = ['redirects', activeSiteId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<RedirectListResponse>(key);
      if (previous) {
        qc.setQueryData<RedirectListResponse>(key, {
          ...previous,
          items: previous.items.filter((r) => r.id !== id),
          total: Math.max(0, previous.total - 1),
        });
      }
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(['redirects', activeSiteId], context.previous);
      }
      toast.error('Failed to delete redirect', err?.response?.data?.message || err?.message);
    },
    onSuccess: () => toast.success('Redirect deleted'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['redirects', activeSiteId] }),
  });

  const errorMessage = error
    ? (error as any).response?.data?.message || (error as Error).message
    : '';

  return (
    <>
      <PageHeader
        title="Redirects"
        description="URL redirect rules per site. Applied at the edge."
        breadcrumbs={[
          { label: 'dimi-cms', href: '/dashboard' },
          { label: 'Content Delivery' },
          { label: 'Redirects' },
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
            {data && <span className="ml-auto text-xs text-muted-foreground">{data.total} rules</span>}
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
              <CardTitle>Add redirect</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-2">
              <div className="min-w-[10rem] flex-1">
                <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="/old-path" />
              </div>
              <ArrowRight className="mb-2.5 h-4 w-4 text-muted-foreground" />
              <div className="min-w-[10rem] flex-1">
                <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="/new-path" />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['301', '302', '307', '308'].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => create.mutate()} disabled={!from || !to || create.isPending} size="sm">
                <Plus className="h-4 w-4" />
                {create.isPending ? 'Adding…' : 'Add'}
              </Button>
            </CardContent>
          </Card>
        )}

        {data && (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No redirects yet.
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.fromPath}</TableCell>
                    <TableCell className="font-mono text-xs text-primary">{r.toPath}</TableCell>
                    <TableCell>
                      <Badge variant="muted" className="font-mono">
                        {r.statusCode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Off</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(r.id)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
