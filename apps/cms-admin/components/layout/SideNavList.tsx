'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { NAV_SECTIONS } from './nav-config';

interface Props {
  onNavigate?: () => void;
}

export function SideNavList({ onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col gap-6 px-3 py-5 text-sm">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <div className="px-2 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">
            {section.label}
          </div>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname?.startsWith(item.href + '/');
              const base =
                'group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[0.85rem] transition-colors';
              if (item.disabled) {
                return (
                  <li key={item.href}>
                    <span className={cn(base, 'cursor-not-allowed text-sidebar-foreground/40')}>
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide text-sidebar-foreground/50">
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </li>
                );
              }
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      base,
                      active
                        ? 'bg-sidebar-accent text-white'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-white',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 transition-colors',
                        active ? 'text-primary' : 'text-sidebar-foreground/60 group-hover:text-white',
                      )}
                    />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide text-primary">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
