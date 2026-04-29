'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { marked } from 'marked';
import { Save, Send, Eye, EyeOff, Trash2 } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';
import { api } from '@/lib/api';
import type { ContentEntry, ContentStatus, Site } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

const STATUS_VARIANT: Record<ContentStatus, BadgeProps['variant']> = {
  published: 'success',
  draft: 'muted',
  in_review: 'warning',
  scheduled: 'default',
  archived: 'destructive',
};

interface Props {
  // For edit mode, pass the existing entry; for create mode, pass siteId only
  entry?: ContentEntry;
  defaultSiteId?: string;
  defaultType?: string;
}

interface FormState {
  siteId: string;
  contentType: string;
  slug: string;
  locale: string;
  title: string;
  body: string;
  excerpt: string;
  cacheTagsCsv: string;
  changeNote: string;
}

const CONTENT_TYPES = ['page', 'article', 'post', 'product'] as const;
const LOCALES = ['en', 'ko', 'ja', 'fr', 'de'] as const;

export function ContentEditor({ entry, defaultSiteId = '', defaultType = 'page' }: Props) {
  const isEdit = !!entry;
  const [showPreview, setShowPreview] = useState(false);

  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const initialBody =
    typeof entry?.currentVersion?.fields?.body === 'string'
      ? (entry.currentVersion.fields.body as string)
      : '';
  const initialExcerpt =
    typeof entry?.currentVersion?.fields?.excerpt === 'string'
      ? (entry.currentVersion.fields.excerpt as string)
      : '';

  const [form, setForm] = useState<FormState>({
    siteId: entry?.siteId || defaultSiteId,
    contentType: entry?.contentType || defaultType,
    slug: entry?.slug || '',
    locale: entry?.locale || 'en',
    title: entry?.currentVersion?.title || '',
    body: initialBody,
    excerpt: initialExcerpt,
    cacheTagsCsv: (entry?.currentVersion?.cacheTags || []).join(', '),
    changeNote: '',
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Preview HTML — sanitised via DOMPurify before rendering
  const previewHtml = (() => {
    try {
      const raw = marked.parse(form.body || '', { async: false }) as string;
      return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    } catch {
      return '';
    }
  })();

  // Sites lookup for the select
  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const r = await api.get('/admin/sites');
      return (Array.isArray(r.data) ? r.data : r.data?.items ?? []) as Site[];
    },
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: async () => {
      const cacheTags = form.cacheTagsCsv
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const r = await api.post(`/admin/content/${form.contentType}`, {
        siteId: form.siteId,
        slug: form.slug,
        locale: form.locale,
        title: form.title,
        fields: { body: form.body, excerpt: form.excerpt },
        meta: cacheTags.length ? { cacheTags } : undefined,
      });
      return r.data as ContentEntry;
    },
    onSuccess: (e) => {
      toast.success('Content created', e.slug);
      qc.invalidateQueries({ queryKey: ['content'] });
      router.push(`/content/${e.id}`);
    },
    onError: (err: any) =>
      toast.error('Failed to create', err.response?.data?.message || err.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error('No entry');
      const r = await api.put(`/admin/content/${form.contentType}/${entry.id}`, {
        fields: { body: form.body, excerpt: form.excerpt },
        changeNote: form.changeNote || undefined,
      });
      return r.data as ContentEntry;
    },
    onSuccess: () => {
      toast.success('Saved new version');
      qc.invalidateQueries({ queryKey: ['content'] });
      qc.invalidateQueries({ queryKey: ['content-entry', entry?.id] });
    },
    onError: (err: any) =>
      toast.error('Failed to save', err.response?.data?.message || err.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error('No entry');
      await api.delete(`/admin/content/${form.contentType}/${entry.id}`);
    },
    onSuccess: () => {
      toast.success('Content deleted');
      qc.invalidateQueries({ queryKey: ['content'] });
      router.push('/content');
    },
    onError: (err: any) =>
      toast.error('Failed to delete', err.response?.data?.message || err.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (isEdit) update.mutate();
    else create.mutate();
  }

  function confirmDelete() {
    if (!entry) return;
    if (window.confirm(`Delete "${entry.slug}" and all its versions?`)) remove.mutate();
  }

  const saving = create.isPending || update.isPending;

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Content body</CardTitle>
            <p className="text-xs text-muted-foreground">
              Markdown. Sanitised on render. Use <code className="rounded bg-muted px-1">## H2</code>,{' '}
              <code className="rounded bg-muted px-1">**bold**</code>, links, lists, code blocks.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Article title"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea
                id="excerpt"
                value={form.excerpt}
                onChange={(e) => set('excerpt', e.target.value)}
                rows={2}
                placeholder="Short description for listings and search results"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="body">Body</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview((v) => !v)}
              >
                {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPreview ? 'Hide preview' : 'Preview'}
              </Button>
            </div>

            <div className={cn('grid gap-3', showPreview && 'md:grid-cols-2')}>
              <Textarea
                id="body"
                value={form.body}
                onChange={(e) => set('body', e.target.value)}
                rows={20}
                className="font-mono text-xs"
                placeholder="# Welcome&#10;&#10;Type Markdown here..."
              />
              {showPreview && (
                <div
                  className="prose prose-neutral max-w-none rounded-md border bg-muted/20 p-4 text-sm prose-headings:tracking-tight prose-a:text-primary"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              )}
            </div>

            {isEdit && (
              <div className="space-y-1.5 pt-2">
                <Label htmlFor="note">Change note</Label>
                <Input
                  id="note"
                  value={form.changeNote}
                  onChange={(e) => set('changeNote', e.target.value)}
                  placeholder="Why did this change? (saved with version history)"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            {entry && (
              <Badge variant={STATUS_VARIANT[entry.status] || 'muted'} className="w-fit">
                {entry.status}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Site</Label>
              <Select
                value={form.siteId}
                onValueChange={(v) => set('siteId', v)}
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  {(sites || []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} <span className="ml-2 font-mono text-[0.65rem] text-muted-foreground">{s.slug}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Content type</Label>
              <Select
                value={form.contentType}
                onValueChange={(v) => set('contentType', v)}
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="hello-world"
                className="font-mono text-xs"
                disabled={isEdit}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Locale</Label>
              <Select value={form.locale} onValueChange={(v) => set('locale', v)} disabled={isEdit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isEdit && (
              <div className="space-y-1.5">
                <Label htmlFor="cacheTags">Cache tags (comma-separated)</Label>
                <Input
                  id="cacheTags"
                  value={form.cacheTagsCsv}
                  onChange={(e) => set('cacheTagsCsv', e.target.value)}
                  placeholder="article, hero, en"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={saving || !form.title || !form.slug || !form.siteId}>
            {isEdit ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {saving ? 'Saving…' : isEdit ? 'Save new version' : 'Create draft'}
          </Button>
          {isEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={confirmDelete}
              disabled={remove.isPending}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
