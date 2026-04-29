'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Trash2, Copy, Check } from 'lucide-react';
import { api } from '@/lib/api';
import type { MediaAsset } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';

interface Props {
  asset: MediaAsset | null;
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssetDetailSheet({ asset, siteId, open, onOpenChange }: Props) {
  const [altText, setAltText] = useState('');
  const [tagsCsv, setTagsCsv] = useState('');
  const [copied, setCopied] = useState(false);

  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (asset) {
      setAltText(asset.altText || '');
      setTagsCsv((asset.tags || []).join(', '));
    }
  }, [asset?.id]);

  const update = useMutation({
    mutationFn: async () => {
      if (!asset) throw new Error('No asset');
      const tags = tagsCsv
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await api.patch(`/admin/assets/${asset.id}`, { altText, tags });
      return res.data as MediaAsset;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets', siteId] });
      toast.success('Asset updated');
    },
    onError: (err: any) =>
      toast.error('Failed to update', err.response?.data?.message || err.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!asset) throw new Error('No asset');
      await api.delete(`/admin/assets/${asset.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets', siteId] });
      toast.success('Asset deleted');
      onOpenChange(false);
    },
    onError: (err: any) =>
      toast.error('Failed to delete', err.response?.data?.message || err.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    update.mutate();
  }

  async function copyUrl() {
    if (!asset?.cdnUrl) return;
    try {
      await navigator.clipboard.writeText(asset.cdnUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Clipboard not available');
    }
  }

  function confirmDelete() {
    if (!asset) return;
    if (window.confirm(`Delete "${asset.filename}"? This cannot be undone.`)) remove.mutate();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="truncate pr-8">{asset?.filename || 'Asset'}</SheetTitle>
        </SheetHeader>

        {asset && (
          <>
            {asset.mimeType.startsWith('image/') && asset.cdnUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.cdnUrl}
                alt={asset.altText || asset.filename}
                className="max-h-64 w-full rounded-md border bg-muted object-contain"
              />
            ) : (
              <div className="grid h-32 w-full place-items-center rounded-md border bg-muted text-sm text-muted-foreground">
                {asset.mimeType}
              </div>
            )}

            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              <div className="grid grid-cols-2 gap-y-1.5">
                <span className="text-muted-foreground">ID</span>
                <span className="truncate font-mono">{asset.id}</span>
                <span className="text-muted-foreground">Type</span>
                <span className="font-mono">{asset.mimeType}</span>
                <span className="text-muted-foreground">Size</span>
                <span className="font-mono">{asset.fileSize.toLocaleString()} B</span>
                <span className="text-muted-foreground">Uploaded</span>
                <span>{new Date(asset.uploadedAt).toLocaleString()}</span>
              </div>
            </div>

            {asset.cdnUrl && (
              <div className="space-y-1.5">
                <Label>CDN URL</Label>
                <div className="flex gap-1.5">
                  <Input readOnly value={asset.cdnUrl} className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={copyUrl} aria-label="Copy">
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="altText">Alt text</Label>
                <Input
                  id="altText"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Describe this image for accessibility"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={tagsCsv}
                  onChange={(e) => setTagsCsv(e.target.value)}
                  placeholder="hero, banner, en"
                />
                {tagsCsv && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tagsCsv
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .map((t) => (
                        <Badge key={t} variant="muted" className="text-[0.65rem]">
                          {t}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={confirmDelete}
                  disabled={remove.isPending}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {remove.isPending ? 'Deleting…' : 'Delete'}
                </Button>
                <Button type="submit" size="sm" disabled={update.isPending}>
                  <Save className="h-4 w-4" />
                  {update.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
