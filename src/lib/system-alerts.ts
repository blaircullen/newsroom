import prisma from '@/lib/prisma';

/**
 * Raise (or update) a system alert. Upserts by type so only one alert
 * per type exists. Sets isActive=true and updates the message.
 */
export async function raiseAlert(
  type: string,
  message: string,
  severity: 'error' | 'warning' = 'error'
) {
  try {
    await prisma.systemAlert.upsert({
      where: { type },
      create: { type, message, severity, isActive: true },
      update: { message, severity, isActive: true, resolvedAt: null },
    });
  } catch (error) {
    console.error(`[SystemAlert] Failed to raise alert "${type}":`, error);
  }
}

/**
 * Resolve an alert by type — sets isActive=false and records resolvedAt.
 * No-op if the alert doesn't exist or is already resolved.
 */
export async function resolveAlert(type: string) {
  try {
    await prisma.systemAlert.updateMany({
      where: { type, isActive: true },
      data: { isActive: false, resolvedAt: new Date() },
    });
  } catch (error) {
    console.error(`[SystemAlert] Failed to resolve alert "${type}":`, error);
  }
}

/**
 * Return all currently active system alerts.
 */
export async function getActiveAlerts() {
  return prisma.systemAlert.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}
