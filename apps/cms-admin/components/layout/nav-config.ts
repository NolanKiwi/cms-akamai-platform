import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Globe,
  FileText,
  ArrowRightLeft,
  Image,
  Trash2,
  Webhook,
  BarChart3,
  Users,
  ShieldCheck,
  Settings,
  TerminalSquare,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Content Delivery',
    items: [
      { href: '/sites', label: 'Sites', icon: Globe },
      { href: '/content', label: 'Content', icon: FileText },
      { href: '/redirects', label: 'Redirects', icon: ArrowRightLeft },
      { href: '/assets', label: 'Assets', icon: Image },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/purge', label: 'Purge', icon: Trash2 },
      { href: '/webhooks', label: 'Webhooks', icon: Webhook },
      { href: '/reports', label: 'Reports', icon: BarChart3, badge: 'soon', disabled: true },
    ],
  },
  {
    label: 'Identity & Access',
    items: [
      { href: '/users', label: 'Users', icon: Users },
      { href: '/roles', label: 'Roles', icon: ShieldCheck, badge: 'soon', disabled: true },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/api-tester', label: 'API Tester', icon: TerminalSquare },
      { href: '/settings', label: 'Settings', icon: Settings, badge: 'soon', disabled: true },
    ],
  },
];
