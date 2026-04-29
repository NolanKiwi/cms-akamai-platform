'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Search, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface CreatorScanResponse {
  user: string;
  scanning: boolean;
  count: number;
  items: Array<{
    propertyId: string;
    propertyName: string;
    productionVersion: number | null;
    stagingVersion: number | null;
    latestVersion: number | null;
    groupId: string;
    groupName: string;
    contractId: string;
    createdBy: string;
    createdAt: string;
  }>;
  lastScanAt?: number;
  lastError?: string;
  progress?: { groupsScanned: number; totalGroups: number; propertiesScanned: number };
}

async function fetchCreatorScan(user: string): Promise<CreatorScanResponse> {
  const r = await api.get(`/admin/akamai/papi/properties-by-creator?user=${encodeURIComponent(user)}`);
  return r.data;
}

interface Props {
  user?: string;
}

export function AkamaiPropertiesPanel({ user = 'gdimitri' }: Props) {
  const qc = useQueryClient();

  const { data, error } = useQuery({
    queryKey: ['akamai-creator', user],
    queryFn: () => fetchCreatorScan(user),
    refetchInterval: (query) =>
      // poll every 5s while scanning, else stop
      query.state.data?.scanning ? 5000 : false,
    refetchIntervalInBackground: false,
  });

  // first mount: trigger an initial scan if no cache
  useEffect(() => {
    if (data && !data.scanning && data.count === 0 && !data.lastScanAt) {
      api
        .get(`/admin/akamai/papi/properties-by-creator?user=${encodeURIComponent(user)}&force=true`)
        .then(() => qc.invalidateQueries({ queryKey: ['akamai-creator', user] }));
    }
  }, [data?.lastScanAt]);

  const refresh = useMutation({
    mutationFn: () =>
      api.get(`/admin/akamai/papi/properties-by-creator?user=${encodeURIComponent(user)}&force=true`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['akamai-creator', user] }),
  });

  const errorMessage = error
    ? (error as any).response?.data?.message || (error as Error).message
    : data?.lastError;

  const pct =
    data?.progress && data.progress.totalGroups > 0
      ? Math.round((data.progress.groupsScanned / data.progress.totalGroups) * 100)
      : 0;

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-4">
        <div>
          <CardTitle className="text-base">Akamai properties · created by {user}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Scans every PAPI group in the account and matches v1{' '}
            <code className="rounded bg-muted px-1">updatedByUser</code>.
            {data?.lastScanAt && !data.scanning && (
              <> Cached at {new Date(data.lastScanAt).toLocaleTimeString()}.</>
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={data?.scanning || refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          <RefreshCw className={data?.scanning ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          {data?.scanning ? 'Scanning…' : 'Rescan'}
        </Button>
      </CardHeader>

      {data?.scanning && (
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              <Search className="-mt-0.5 mr-1 inline h-3 w-3" />
              groups {data.progress?.groupsScanned ?? 0} / {data.progress?.totalGroups ?? '?'} ·
              properties scanned {data.progress?.propertiesScanned ?? 0} · matches so far{' '}
              <strong>{data.count}</strong>
            </span>
            <span className="font-mono text-muted-foreground">{pct}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {errorMessage && (
        <CardContent className="border-t border-border py-4 text-sm text-destructive">
          {errorMessage}
        </CardContent>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Property</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>Prod</TableHead>
            <TableHead>Staging</TableHead>
            <TableHead>Latest</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!data && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {data && !data.scanning && data.count === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                No properties found whose v1 was authored by {user}.
              </TableCell>
            </TableRow>
          )}
          {data?.items.map((p) => (
            <TableRow key={p.propertyId}>
              <TableCell className="font-medium">
                <span className="font-mono text-xs text-muted-foreground">{p.propertyId} · </span>
                {p.propertyName}
              </TableCell>
              <TableCell className="text-xs">
                <span className="font-mono text-muted-foreground">{p.groupId}</span>
                <span className="ml-2">{p.groupName}</span>
              </TableCell>
              <TableCell>
                {p.productionVersion ? (
                  <Badge variant="success" className="font-mono text-[0.65rem]">
                    v{p.productionVersion}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {p.stagingVersion ? (
                  <Badge variant="warning" className="font-mono text-[0.65rem]">
                    v{p.stagingVersion}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">{p.latestVersion ?? '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
              </TableCell>
              <TableCell className="text-right">
                <a
                  href={`https://control.akamai.com/apps/property-manager/#/property-version/${p.propertyId}/${p.latestVersion ?? 1}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Open in Akamai Control Center"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
