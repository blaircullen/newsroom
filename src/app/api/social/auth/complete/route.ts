import { NextRequest, NextResponse } from 'next/server';

// GET /api/social/auth/complete - OAuth popup completion page
// Returns minimal HTML that sends postMessage to opener and auto-closes
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') || '';
  const handle = searchParams.get('handle') || '';
  const count = searchParams.get('count') || '';
  const error = searchParams.get('error') || '';

  const origin = process.env.NEXTAUTH_URL || '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${error ? 'Connection Failed' : 'Connected!'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f9fafb;
      color: #111827;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    p { color: #6b7280; font-size: 0.875rem; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${error ? '\u274c' : '\u2705'}</div>
    <h1>${error ? 'Connection Failed' : 'Connected!'}</h1>
    <p>${error ? 'This window will close shortly.' : 'This window will close automatically.'}</p>
  </div>
  <script>
    (function() {
      var message = {
        type: 'oauth-complete',
        platform: ${JSON.stringify(platform)},
        handle: ${JSON.stringify(handle)},
        count: ${JSON.stringify(count)},
        error: ${JSON.stringify(error)}
      };
      if (window.opener) {
        window.opener.postMessage(message, ${JSON.stringify(origin)});
      }
      setTimeout(function() { window.close(); }, 1500);
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
