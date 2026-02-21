import prisma from '@/lib/prisma';

/**
 * Fire-and-forget audit logger. Catches its own errors so callers
 * don't need to handle audit failures.
 */
export function logAudit(params: {
  action: string;
  resourceType: string;
  resourceId: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}): void {
  prisma.auditLog
    .create({
      data: {
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        userId: params.userId ?? null,
        metadata: params.metadata ? (params.metadata as object) : undefined,
      },
    })
    .catch((err) => {
      console.error('[Audit] Failed to write audit log:', err);
    });
}
