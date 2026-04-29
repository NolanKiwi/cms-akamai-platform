import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { QueryProvider } from '@/components/QueryProvider';
import { ToastProvider } from '@/components/ui/toast';
import { SessionToastBridge } from '@/components/SessionToastBridge';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'dimi-cms', template: '%s · dimi-cms' },
  description: 'dimi-cms — content delivery & cache control console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <QueryProvider>
          <ToastProvider>
            <SessionToastBridge />
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
