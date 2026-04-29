'use client';

import { useState, FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { Site } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function CreateSiteSheet({ open, onOpenChange }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [hostname, setHostname] = useState('');
  const [locales, setLocales] = useState<string[]>(['en']);
  const [newLocale, setNewLocale] = useState('');
  const [defaultLocale, setDefaultLocale] = useState('en');

  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.post('/admin/sites', {
        name,
        slug: slug || slugify(name),
        hostname: hostname || undefined,
        locales,
        defaultLocale,
      });
      return res.data as Site;
    },
    onSuccess: (created) => {
      toast.success('Site created', created.name);
      qc.invalidateQueries({ queryKey: ['sites'] });
      reset();
      onOpenChange(false);
      router.push(`/sites/${created.id}`);
    },
    onError: (err: any) =>
      toast.error('Failed to create site', err.response?.data?.message || err.message),
  });

  function reset() {
    setName('');
    setSlug('');
    setSlugTouched(false);
    setHostname('');
    setLocales(['en']);
    setDefaultLocale('en');
    setNewLocale('');
  }

  function addLocale() {
    const v = newLocale.trim().toLowerCase();
    if (!v || locales.includes(v)) return;
    setLocales([...locales, v]);
    setNewLocale('');
  }

  function removeLocale(l: string) {
    if (locales.length <= 1) return;
    const next = locales.filter((x) => x !== l);
    setLocales(next);
    if (defaultLocale === l) setDefaultLocale(next[0]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New site</SheetTitle>
        </SheetHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="Marketing Site"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-slug">Slug</Label>
            <Input
              id="new-slug"
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugTouched(true);
              }}
              placeholder="marketing"
              className="font-mono text-xs"
              required
              maxLength={64}
            />
            <p className="text-[0.65rem] text-muted-foreground">
              Used in URLs and cache tags. Lowercase letters, digits, dash, underscore only.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-hostname">Hostname</Label>
            <Input
              id="new-hostname"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="www.example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Locales</Label>
            <p className="text-[0.65rem] text-muted-foreground">Click a locale to set as default.</p>
            <div className="flex flex-wrap gap-1.5">
              {locales.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setDefaultLocale(l)}
                  className="inline-flex items-center"
                >
                  <Badge
                    variant={l === defaultLocale ? 'default' : 'muted'}
                    className="font-mono text-xs uppercase"
                  >
                    {l}
                    {l === defaultLocale && ' · default'}
                    {locales.length > 1 && (
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
            <div className="flex gap-2 pt-1">
              <Input
                value={newLocale}
                onChange={(e) => setNewLocale(e.target.value)}
                placeholder="ko, ja, fr…"
                className="max-w-[8rem] font-mono text-xs uppercase"
                maxLength={8}
              />
              <Button type="button" variant="outline" size="sm" onClick={addLocale} disabled={!newLocale.trim()}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={create.isPending || !name || !slug}>
              {create.isPending ? 'Creating…' : 'Create site'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
