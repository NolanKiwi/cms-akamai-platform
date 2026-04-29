import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'dimi-cms', template: '%s · dimi-cms' },
  description: 'Public web frontend powered by dimi-cms',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
