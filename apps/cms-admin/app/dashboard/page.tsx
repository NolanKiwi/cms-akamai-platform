'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { AreaChart, BarList } from '@tremor/react';
import { Activity, Globe, FileText, Trash2, Gauge } from 'lucide-react';
import { api } from '@/lib/api';
import type { Site } from '@/lib/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PurgeLog {
  id: string;
  status: string;
  submittedAt: string;
  completedAt?: string;
  scope?: string;
}

interface PurgeListResponse {
  total: number;
  items: PurgeLog[];
}

const SAMPLE_TRAFFIC = [
  { date: 'Mon', Hits: 124000, Misses: 18000 },
  { date: 'Tue', Hits: 138400, Misses: 19500 },
  { date: 'Wed', Hits: 145200, Misses: 17800 },
  { date: 'Thu', Hits: 152300, Misses: 21200 },
  { date: 'Fri', Hits: 168900, Misses: 22600 },
  { date: 'Sat', Hits: 121500, Misses: 14300 },
  { date: 'Sun', Hits: 109800, Misses: 12100 },
];

const TOP_TAGS = [
  { name: 'site:default', value: 4820 },
  { name: 'article:*', value: 3140 },
  { name: 'page:home', value: 1980 },
  { name: 'asset:*', value: 1140 },
  { name: 'redirect:*', value: 312 },
];

async function fetchHealth() {
  const r = await api.get('/health');
  return r.data;
}

async function fetchSitesCount(): Promise<Site[]> {
  const r = await api.get('/admin/sites');
  return Array.isArray(r.data) ? r.data : r.data?.items ?? [];
}

async function fetchPurgeHistory(): Promise<PurgeListResponse> {
  const r = await api.get('/admin/purge?size=200');
  return r.data;
}

function isToday(iso?: string) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function DashboardPage() {
  const [healthQ, sitesQ, purgesQ] = useQueries({
    queries: [
      { queryKey: ['health'], queryFn: fetchHealth, retry: false, staleTime: 30_000 },
      { queryKey: ['sites'], queryFn: fetchSitesCount, retry: false, staleTime: 60_000 },
      { queryKey: ['purges-recent'], queryFn: fetchPurgeHistory, retry: false, staleTime: 30_000 },
    ],
  });

  const health: 'loading' | 'ok' | 'error' = healthQ.isLoading
    ? 'loading'
    : healthQ.error
      ? 'error'
      : healthQ.data?.status === 'ok'
        ? 'ok'
        : 'error';

  const sitesValue = sitesQ.data ? String(sitesQ.data.length) : sitesQ.error ? '—' : '…';
  const purgesToday = purgesQ.data?.items?.filter((p) => isToday(p.submittedAt)).length;
  const purgesValue = purgesQ.data
    ? String(purgesToday ?? 0)
    : purgesQ.error
      ? '—'
      : '…';

  const kpis = [
    {
      label: 'Sites',
      value: sitesValue,
      delta: sitesQ.data ? 'configured' : sitesQ.error ? 'unauthorized or offline' : '',
      icon: Globe,
    },
    {
      label: 'Content entries',
      value: '—',
      delta: 'requires per-site filter',
      icon: FileText,
    },
    {
      label: 'Purges today',
      value: purgesValue,
      delta: purgesQ.data ? `of ${purgesQ.data.total ?? purgesQ.data.items?.length} total` : '',
      icon: Trash2,
    },
    { label: 'Cache hit rate', value: '—', delta: 'reports endpoint pending', icon: Gauge },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Operations overview across sites, content delivery, and cache."
        breadcrumbs={[{ label: 'dimi-cms', href: '/dashboard' }, { label: 'Dashboard' }]}
        actions={
          <Badge
            variant={health === 'ok' ? 'success' : health === 'error' ? 'destructive' : 'muted'}
            className="gap-1.5"
          >
            <Activity className="h-3 w-3" />
            API: {health}
          </Badge>
        }
      />

      <div className="flex flex-col gap-6 px-6 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <Card key={k.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {k.label}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{k.value}</div>
                  {k.delta && <p className="mt-1 text-xs text-muted-foreground">{k.delta}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Edge traffic — last 7 days</CardTitle>
              <p className="text-xs text-muted-foreground">
                Sample series. Wire to <code className="rounded bg-muted px-1">/admin/reports/cache</code> once
                available.
              </p>
            </CardHeader>
            <CardContent>
              <AreaChart
                className="h-72"
                data={SAMPLE_TRAFFIC}
                index="date"
                categories={['Hits', 'Misses']}
                colors={['orange', 'cyan']}
                showLegend
                showGridLines
                valueFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top cache tags</CardTitle>
              <p className="text-xs text-muted-foreground">By purge volume (sample).</p>
            </CardHeader>
            <CardContent>
              <BarList data={TOP_TAGS} color="orange" valueFormatter={(v: number) => v.toLocaleString()} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
