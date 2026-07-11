'use client';

function isStaleServerActionError(error: Error & { digest?: string }) {
  return (
    /Failed to find Server Action/.test(error.message) ||
    /Cannot read properties of undefined \(reading 'workers'\)/.test(error.message)
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isStaleAction = isStaleServerActionError(error);

  return (
    <html lang="en">
      <body>
        <main
          style={{
            alignItems: 'center',
            background: '#f8f9fa',
            color: '#111827',
            display: 'flex',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            justifyContent: 'center',
            margin: 0,
            minHeight: '100vh',
            padding: 24,
          }}
        >
          <section style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 24, lineHeight: 1.2, margin: '0 0 12px' }}>
              {isStaleAction ? 'A new version of NewsRoom is available' : 'Something went wrong'}
            </h1>
            <p style={{ color: '#4b5563', fontSize: 15, lineHeight: 1.5, margin: '0 0 20px' }}>
              {isStaleAction
                ? 'This tab is using an older site bundle. Reload to continue with the latest version.'
                : 'An unexpected error occurred. Try again or reload the page.'}
            </p>
            <button
              type="button"
              onClick={() => (isStaleAction ? window.location.reload() : reset())}
              style={{
                background: '#d42b2b',
                border: 0,
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                font: 'inherit',
                fontWeight: 600,
                padding: '10px 16px',
              }}
            >
              {isStaleAction ? 'Reload' : 'Try again'}
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
