import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSite, type PublicSite } from '@/lib/cms';

interface Props {
  params: { siteId: string };
  children: React.ReactNode;
}

export async function generateMetadata({ params }: { params: { siteId: string } }): Promise<Metadata> {
  const site = await getSite(params.siteId);
  if (!site) return { title: 'Not found' };
  return {
    title: { default: site.name, template: `%s · ${site.name}` },
    description: site.description || site.branding?.tagline || undefined,
    icons: site.branding?.faviconUrl ? [{ url: site.branding.faviconUrl }] : undefined,
  };
}

function buildThemeStyle(site: PublicSite): string | null {
  const t = site.theme;
  if (!t) return null;
  const decls: string[] = [];
  if (t.primary) decls.push(`--primary: ${t.primary};`);
  if (t.accent) decls.push(`--accent: ${t.accent};`);
  if (t.background) decls.push(`--background: ${t.background};`);
  if (t.foreground) decls.push(`--foreground: ${t.foreground};`);
  if (t.radius) decls.push(`--radius: ${t.radius};`);
  return decls.length ? `:root{${decls.join('')}}` : null;
}

export default async function SiteLayout({ params, children }: Props) {
  const site = await getSite(params.siteId);
  if (!site) notFound();

  const themeCss = buildThemeStyle(site);

  return (
    <>
      {themeCss && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
            <Link href={`/sites/${params.siteId}`} className="flex items-center gap-2">
              {site.branding?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={site.branding.logoUrl} alt={site.name} className="h-7 w-auto" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                  {site.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-sm font-semibold tracking-tight">{site.name}</span>
            </Link>
            {site.branding?.tagline && (
              <span className="hidden text-xs text-muted-foreground md:inline">
                {site.branding.tagline}
              </span>
            )}
            <nav className="ml-auto flex items-center gap-4 text-sm">
              <Link
                href={`/sites/${params.siteId}/search`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Search
              </Link>
            </nav>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border py-6">
          <div className="mx-auto max-w-5xl px-6 text-xs text-muted-foreground">
            © {new Date().getFullYear()} {site.name} · powered by dimi-cms
          </div>
        </footer>
      </div>
    </>
  );
}
