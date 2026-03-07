/**
 * scanner-sse.ts — In-memory SSE client registry for scanner new-scan notifications.
 * Works correctly for single-server deployment (Docker on Hetzner).
 */

type SSEController = ReadableStreamDefaultController<Uint8Array>;

const clients = new Set<SSEController>();
const encoder = new TextEncoder();

function send(controller: SSEController, data: unknown) {
  try {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  } catch {
    clients.delete(controller);
  }
}

export function addSSEClient(controller: SSEController) {
  clients.add(controller);
  send(controller, { type: 'connected' });
}

export function removeSSEClient(controller: SSEController) {
  clients.delete(controller);
}

export function broadcastNewScan(scanRunId: string, pickedCount: number) {
  const dead: SSEController[] = [];
  for (const controller of Array.from(clients)) {
    try {
      send(controller, { type: 'new-scan', scanRunId, pickedCount });
    } catch {
      dead.push(controller);
    }
  }
  dead.forEach((c) => clients.delete(c));
}
