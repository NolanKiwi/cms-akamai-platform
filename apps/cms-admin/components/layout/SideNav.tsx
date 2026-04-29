'use client';

import { SideNavList } from './SideNavList';

export function SideNav() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block">
      <SideNavList />
    </aside>
  );
}
