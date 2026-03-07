import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addSSEClient, removeSSEClient } from '@/lib/scanner-sse';

export const dynamic = 'force-dynamic';

/**
 * GET /api/scanner/events
 * SSE stream that pushes new-scan notifications to connected clients.
 * Admin only.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let keepalive: ReturnType<typeof setInterval>;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      addSSEClient(ctrl);

      // Keepalive ping every 25s to prevent proxy timeouts
      keepalive = setInterval(() => {
        try {
          ctrl.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(keepalive);
          removeSSEClient(ctrl);
        }
      }, 25_000);
    },
    cancel() {
      clearInterval(keepalive);
      if (controller) removeSSEClient(controller);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
