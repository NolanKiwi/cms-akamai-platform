'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background: 'hsl(222 28% 12%)',
          color: 'hsl(0 0% 98%)',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div
            style={{
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'hsl(14 90% 53%)',
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            dimi-cms
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px 0' }}>App crashed</h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
            The shell could not render. Try a reload.
          </p>
          {error?.message && (
            <pre
              style={{
                textAlign: 'left',
                background: 'rgba(255,255,255,0.05)',
                padding: 12,
                borderRadius: 6,
                fontSize: 12,
                overflow: 'auto',
              }}
            >
              {error.message}
            </pre>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: 'hsl(14 90% 53%)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
