import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/social/queue/stats — Lightweight stats for sidebar polling
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['ADMIN', 'EDITOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [statusCounts, sentLast24h, sites] = await Promise.all([
      // Count by status (excludes SENT)
      prisma.socialPost.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { status: { notIn: ['SENT', 'SENDING'] } },
      }),
      // Sent in last 24h
      prisma.socialPost.count({
        where: { status: 'SENT', sentAt: { gte: oneDayAgo } },
      }),
      // Posts per publish target (site)
      prisma.socialPost.groupBy({
        by: ['socialAccountId'],
        _count: { id: true },
        where: { status: { notIn: ['SENT', 'SENDING'] } },
      }),
    ]);

    // Build status map
    const statusMap: Record<string, number> = {};
    for (const row of statusCounts) {
      statusMap[row.status] = row._count.id;
    }

    // Resolve site info for each socialAccount
    const accountIds = sites.map((s) => s.socialAccountId);
    const accounts = accountIds.length > 0
      ? await prisma.socialAccount.findMany({
          where: { id: { in: accountIds } },
          select: {
            id: true,
            publishTargetId: true,
            publishTarget: {
              select: { id: true, name: true, faviconColor: true },
            },
          },
        })
      : [];

    // Aggregate by publish target
    const siteMap = new Map<string, { id: string; name: string; faviconColor: string | null; postCount: number }>();
    for (const row of sites) {
      const account = accounts.find((a) => a.id === row.socialAccountId);
      const target = account?.publishTarget;
      if (!target) continue;
      const existing = siteMap.get(target.id);
      if (existing) {
        existing.postCount += row._count.id;
      } else {
        siteMap.set(target.id, {
          id: target.id,
          name: target.name,
          faviconColor: target.faviconColor,
          postCount: row._count.id,
        });
      }
    }

    return NextResponse.json({
      failed: statusMap['FAILED'] || 0,
      pending: statusMap['PENDING'] || 0,
      approved: statusMap['APPROVED'] || 0,
      sentLast24h,
      sites: Array.from(siteMap.values()),
    });
  } catch (error) {
    console.error('[API] Error fetching queue stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
