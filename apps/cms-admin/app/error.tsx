'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <Card className="max-w-md">
        <CardHeader className="flex flex-row items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle>Something broke</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. The page state was preserved — try again.
          </p>
          {error.message && (
            <pre className="overflow-auto rounded-md bg-muted/50 p-3 text-xs text-foreground/80">
              {error.message}
            </pre>
          )}
          {error.digest && (
            <p className="font-mono text-[0.65rem] text-muted-foreground">digest: {error.digest}</p>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={reset}>
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
