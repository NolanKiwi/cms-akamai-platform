'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import type { Site } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Props {
  site: Site;
  onSaved?: (site: Site) => void;
}

interface FormState {
  name: string;
  description: string;
  hostname: string;
  defaultLocale: string;
  locales: string[];
  isActive: boolean;
  themePrimary: string;
  themeAccent: string;
  themeRadius: string;
  brandingLogoUrl: string;
  brandingTagline: string;
}

function fromSite(s: Site): FormState {
  return {
    name: s.name || '',
    description: s.description || '',
    hostname: s.hostname || s.domain || '',
    defaultLocale: s.defaultLocale || 'en',
    locales: s.locales || ['en'],
    isActive: s.isActive ?? true,
    themePrimary: s.theme?.primary || '',
    themeAccent: s.theme?.accent || '',
    themeRadius: s.theme?.radius || '',
    brandingLogoUrl: s.branding?.logoUrl || '',
    brandingTagline: s.branding?.tagline || '',
  };
}

export function SiteSettingsForm({ site, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => fromSite(site));
  const [newLocale, setNewLocale] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => setForm(fromSite(site)), [site.id]);

  const save = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.patch(`/admin/sites/${site.id}`, payload);
      return res.data as Site;
    },
    onSuccess: (updated) => {
      setSavedAt(Date.now());
      onSaved?.(updated);
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['site', site.id] });
      toast.success('Site saved', updated.name);
    },
    onError: (err: any) => {
      toast.error(
        'Failed to save site',
        err.response?.data?.message || (err as Error).message,
      );
    },
  });
  const saving = save.isPending;
  const error = save.error
    ? (save.error as any).response?.data?.message ||
      (save.error as Error).message
    : '';

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addLocale() {
    const v = newLocale.trim().toLowerCase();
    if (!v || form.locales.includes(v)) return;
    set('locales', [...form.locales, v]);
    setNewLocale('');
  }

  function removeLocale(l: string) {
    if (form.locales.length <= 1) return;
    set(
      'locales',
      form.locales.filter((x) => x !== l),
    );
    if (form.defaultLocale === l) set('defaultLocale', form.locales.find((x) => x !== l) || 'en');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      name: form.name,
      description: form.description || null,
      hostname: form.hostname || null,
      defaultLocale: form.defaultLocale,
      locales: form.locales,
      isActive: form.isActive,
      theme: {
        ...(form.themePrimary ? { primary: form.themePrimary } : {}),
        ...(form.themeAccent ? { accent: form.themeAccent } : {}),
        ...(form.themeRadius ? { radius: form.themeRadius } : {}),
      },
      branding: {
        ...(form.brandingLogoUrl ? { logoUrl: form.brandingLogoUrl } : {}),
        ...(form.brandingTagline ? { tagline: form.brandingTagline } : {}),
      },
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hostname">Hostname</Label>
            <Input
              id="hostname"
              value={form.hostname}
              onChange={(e) => set('hostname', e.target.value)}
              placeholder="www.example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="flex h-9 items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => set('isActive', e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Active
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Locales</CardTitle>
          <p className="text-xs text-muted-foreground">
            Default locale is highlighted. At least one locale required.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {form.locales.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => set('defaultLocale', l)}
                className="group inline-flex items-center"
                title={l === form.defaultLocale ? 'Default' : 'Click to set as default'}
              >
                <Badge
                  variant={l === form.defaultLocale ? 'default' : 'muted'}
                  className="font-mono text-xs uppercase"
                >
                  {l}
                  {l === form.defaultLocale && ' · default'}
                  {form.locales.length > 1 && (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLocale(l);
                      }}
                      className="ml-1 rounded p-0.5 hover:bg-foreground/10"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </Badge>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newLocale}
              onChange={(e) => setNewLocale(e.target.value)}
              placeholder="ko, ja, fr…"
              className="max-w-[8rem] font-mono text-xs uppercase"
              maxLength={8}
            />
            <Button type="button" variant="outline" size="sm" onClick={addLocale} disabled={!newLocale.trim()}>
              <Plus className="h-4 w-4" />
              Add locale
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <p className="text-xs text-muted-foreground">
            HSL space-separated values (no commas). Example: <code className="rounded bg-muted px-1">14 90% 53%</code>.
            Leave blank to use platform defaults.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="primary">Primary</Label>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-9 w-9 shrink-0 rounded-md border"
                  style={{
                    background: form.themePrimary ? `hsl(${form.themePrimary})` : 'hsl(var(--muted))',
                  }}
                />
                <Input
                  id="primary"
                  value={form.themePrimary}
                  onChange={(e) => set('themePrimary', e.target.value)}
                  placeholder="14 90% 53%"
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accent">Accent</Label>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-9 w-9 shrink-0 rounded-md border"
                  style={{
                    background: form.themeAccent ? `hsl(${form.themeAccent})` : 'hsl(var(--muted))',
                  }}
                />
                <Input
                  id="accent"
                  value={form.themeAccent}
                  onChange={(e) => set('themeAccent', e.target.value)}
                  placeholder="199 89% 48%"
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="radius">Radius</Label>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-9 w-9 shrink-0 border bg-muted"
                  style={{ borderRadius: form.themeRadius || '0' }}
                />
                <Input
                  id="radius"
                  value={form.themeRadius}
                  onChange={(e) => set('themeRadius', e.target.value)}
                  placeholder="0.5rem"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-3 rounded-md border p-3 text-sm"
            style={{
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
            }}
          >
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Preview</span>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
              style={{
                background: form.themePrimary
                  ? `hsl(${form.themePrimary})`
                  : 'hsl(var(--primary))',
                borderRadius: form.themeRadius || undefined,
              }}
            >
              Primary button
            </button>
            <span
              className="rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase"
              style={{
                background: form.themeAccent
                  ? `hsl(${form.themeAccent} / 0.15)`
                  : 'hsl(var(--accent) / 0.15)',
                color: form.themeAccent ? `hsl(${form.themeAccent})` : 'hsl(var(--accent))',
              }}
            >
              accent badge
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              value={form.brandingLogoUrl}
              onChange={(e) => set('brandingLogoUrl', e.target.value)}
              placeholder="https://cdn.example.com/logo.svg"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={form.brandingTagline}
              onChange={(e) => set('brandingTagline', e.target.value)}
              placeholder="Short site description"
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-3">
        {savedAt && !error && (
          <span className="text-xs text-success">Saved {new Date(savedAt).toLocaleTimeString()}</span>
        )}
        <Button type="submit" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
