export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <div className="max-w-xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
          dimi-cms
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">Public web frontend</h1>
        <p className="mt-2 text-muted-foreground">
          Sites are served at <code className="rounded bg-muted px-1.5 py-0.5 text-sm">/sites/&#91;siteId&#93;/&#91;...slug&#93;</code>.
        </p>
        <p className="mt-6 text-xs text-muted-foreground">
          Cached at the edge with surrogate-key invalidation.
        </p>
      </div>
    </main>
  );
}
