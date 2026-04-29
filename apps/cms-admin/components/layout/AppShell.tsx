'use client';

import { usePathname } from 'next/navigation';
import { TopBar } from './TopBar';
import { SideNav } from './SideNav';
import { TooltipProvider } from '@/components/ui/tooltip';

const FULL_BLEED_PATHS = ['/auth/'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const isFullBleed = FULL_BLEED_PATHS.some((p) => pathname.startsWith(p));

  if (isFullBleed) {
    return <TooltipProvider>{children}</TooltipProvider>;
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col bg-muted/30">
        <TopBar />
        <div className="flex flex-1">
          <SideNav />
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
