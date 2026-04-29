import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-primary">404</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The content you requested isn&rsquo;t available, or it was unpublished.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
