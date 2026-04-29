'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { Site } from '@/lib/types';
import { setStoredActiveSite } from '@/lib/active-site';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

async function fetchSites(): Promise<Site[]> {
  const res = await api.get('/admin/sites');
  return Array.isArray(res.data) ? res.data : res.data?.items ?? [];
}

export function SiteSelector() {
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: fetchSites,
    staleTime: 60_000,
    retry: false,
  });

  const filtered = (sites || []).filter((s) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.slug?.toLowerCase().includes(q) ||
      s.hostname?.toLowerCase().includes(q) ||
      s.domain?.toLowerCase().includes(q)
    );
  });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="topbar" size="sm" className="hidden md:inline-flex">
          {sites && sites.length > 0 ? `${sites.length} sites` : 'All sites'}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-0">
        <DropdownMenuLabel className="px-3 pt-2">Switch site</DropdownMenuLabel>
        <div className="relative px-2 pb-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name, slug, hostname"
            className="h-8 pl-7 text-xs"
            autoFocus
          />
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-72 overflow-y-auto py-1">
          {!sites && <DropdownMenuItem disabled>Loading…</DropdownMenuItem>}
          {sites && filtered.length === 0 && (
            <DropdownMenuItem disabled>{sites.length === 0 ? 'No sites' : 'No matches'}</DropdownMenuItem>
          )}
          {filtered.map((s) => (
            <DropdownMenuItem key={s.id} asChild onSelect={() => setStoredActiveSite(s.id)}>
              <Link href={`/sites/${s.id}`} className="flex flex-col items-start gap-0">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="font-mono text-[0.65rem] text-muted-foreground">{s.slug}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="m-1">
          <Link href="/sites">Manage sites</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
