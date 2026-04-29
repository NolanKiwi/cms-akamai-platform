'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Search, FileText, Film, FileQuestion } from 'lucide-react';
import { api } from '@/lib/api';
import type { MediaAsset, Paginated } from '@/lib/types';
import { useActiveSite } from '@/lib/active-site';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { AssetDetailSheet } from '@/components/assets/AssetDetailSheet';
import { cn } from '@/lib/cn';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FilePlaceholder({ mimeType }: { mimeType: string }) {
  const Icon = mimeType.startsWith('video/')
    ? Film
    : mimeType === 'application/pdf'
      ? FileText
      : FileQuestion;
  return (
    <div className="grid h-28 w-full place-items-center bg-muted">
      <Icon className="h-7 w-7 text-muted-foreground" />
    </div>
  );
}

async function fetchAssets(siteId: string): Promise<Paginated<MediaAsset>> {
  const res = await api.get(`/admin/assets?siteId=${siteId}&size=50`);
  return res.data;
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

async function uploadAsset(
  siteId: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<MediaAsset> {
  const init = await api.post('/admin/assets/upload-url', {
    siteId,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  });
  const { uploadUrl, assetId } = init.data;
  await putWithProgress(uploadUrl, file, onProgress);
  const done = await api.post(`/admin/assets/${assetId}/complete`);
  return done.data;
}

export default function AssetsPage() {
  const [activeSiteId, setActiveSiteId] = useActiveSite();
  const [siteId, setSiteId] = useState('');
  useEffect(() => {
    if (activeSiteId && !siteId) setSiteId(activeSiteId);
  }, [activeSiteId]);
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['assets', activeSiteId],
    queryFn: () => fetchAssets(activeSiteId),
    enabled: !!activeSiteId,
  });
  const loading = isLoading || isFetching;
  const errorMessage = error
    ? (error as any).response?.data?.message || (error as Error).message
    : '';

  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadAsset(activeSiteId, file, (pct) => setProgress({ name: file.name, pct })),
    onMutate: (file) => setProgress({ name: file.name, pct: 0 }),
    onSuccess: (_data, file) => {
      qc.invalidateQueries({ queryKey: ['assets', activeSiteId] });
      toast.success('Uploaded', file.name);
    },
    onError: (err: any, file) =>
      toast.error(`Failed to upload ${file.name}`, err.response?.data?.message || err.message),
    onSettled: () => setProgress(null),
  });

  function uploadFiles(files: FileList | File[]) {
    if (!activeSiteId) {
      toast.error('Select a site first', 'Enter a Site ID and load before uploading.');
      return;
    }
    Array.from(files).forEach((f) => upload.mutate(f));
  }

  function openAsset(a: MediaAsset) {
    setSelected(a);
    setSheetOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Assets"
        description="Digital asset management. Drag and drop files or click upload."
        breadcrumbs={[
          { label: 'dimi-cms', href: '/dashboard' },
          { label: 'Content Delivery' },
          { label: 'Assets' },
        ]}
        actions={
          <Button
            size="sm"
            disabled={!activeSiteId || upload.isPending}
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        }
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length) uploadFiles(files);
          e.target.value = '';
        }}
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
            <Button onClick={() => siteId && setActiveSiteId(siteId)} disabled={!siteId} size="sm">
              <Search className="h-4 w-4" />
              {loading ? 'Loading…' : 'Load'}
            </Button>
            {data && <span className="ml-auto text-xs text-muted-foreground">{data.total} assets</span>}
          </CardContent>
        </Card>

        {errorMessage && (
          <Card>
            <CardContent className="py-4 text-sm text-destructive">{errorMessage}</CardContent>
          </Card>
        )}

        {progress && (
          <Card>
            <CardContent className="space-y-2 py-3">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-mono">{progress.name}</span>
                <span className="ml-2 shrink-0 font-mono text-muted-foreground">{progress.pct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
          }}
          className={cn(
            'rounded-md border-2 border-dashed border-border bg-muted/20 px-6 py-8 text-center text-sm text-muted-foreground transition-colors',
            dragOver && 'border-primary bg-primary/5 text-foreground',
            !activeSiteId && 'opacity-60',
          )}
        >
          <Upload className="mx-auto mb-2 h-5 w-5" />
          {activeSiteId ? (
            <>Drop files here, or use the Upload button.</>
          ) : (
            <>Load a site first, then drop files here.</>
          )}
        </div>

        {data && data.items.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No assets found for this site.
            </CardContent>
          </Card>
        )}

        {data && data.items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {data.items.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => openAsset(asset)}
                className="group overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-primary/40"
              >
                {asset.mimeType.startsWith('image/') && asset.cdnUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.cdnUrl}
                    alt={asset.altText || asset.filename}
                    className="h-28 w-full bg-muted object-cover"
                  />
                ) : (
                  <FilePlaceholder mimeType={asset.mimeType} />
                )}
                <div className="px-2.5 py-2">
                  <p className="truncate text-xs font-medium">{asset.filename}</p>
                  <p className="text-[0.65rem] text-muted-foreground">{formatBytes(asset.fileSize)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <AssetDetailSheet
        asset={selected}
        siteId={activeSiteId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
