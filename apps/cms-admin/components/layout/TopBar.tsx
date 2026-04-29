'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, HelpCircle, Search, ChevronDown, User, Menu } from 'lucide-react';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SideNavList } from './SideNavList';
import { SiteSelector } from './SiteSelector';

export function TopBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="flex h-12 items-center gap-4 border-b border-topbar-border bg-topbar px-4 text-topbar-foreground">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="topbar" size="icon" className="md:hidden" aria-label="Open menu">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-64 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="border-b border-sidebar-border px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                d
              </span>
              dimi-cms
            </SheetTitle>
          </SheetHeader>
          <SideNavList onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <Link href="/dashboard" className="flex items-center gap-2 pr-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
          d
        </span>
        <span className="text-sm font-semibold tracking-tight">dimi-cms</span>
      </Link>

      <div className="hidden h-5 w-px bg-topbar-border md:block" />

      <SiteSelector />

      <span className="hidden rounded-md bg-warning/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-warning lg:inline-block">
        Staging
      </span>

      <div className="relative ml-auto hidden w-72 lg:block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-topbar-foreground/50" />
        <Input
          placeholder="Search sites, content, assets…"
          className="h-8 border-topbar-border bg-white/5 pl-8 text-xs text-topbar-foreground placeholder:text-topbar-foreground/40 focus-visible:ring-primary/60"
        />
      </div>

      <div className="ml-auto flex items-center gap-1 lg:ml-0">
        <Button variant="topbar" size="icon" aria-label="Help">
          <HelpCircle className="h-4 w-4" />
        </Button>
        <Button variant="topbar" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="topbar" size="sm" className="gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[0.65rem] font-semibold">
                A
              </span>
              <span className="hidden text-xs font-medium md:inline">Admin</span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Signed in</DropdownMenuLabel>
            <DropdownMenuItem disabled>
              <User className="h-3.5 w-3.5" />
              <span className="text-xs text-muted-foreground">admin@example.com</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/auth/login">Sign out</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
