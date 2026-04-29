'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Public site error:', error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Error</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">We hit a snag</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page failed to load. Try again, or contact the site operator.
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
