import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'CMS Web', template: '%s | CMS Web' },
  description: 'Powered by CMS Akamai Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
