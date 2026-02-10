import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const previousSince = new Date();
    previousSince.setDate(previousSince.getDate() - days * 2);

    // Current period aggregation
    const currentPeriod = await prisma.featureEvent.groupBy({
      by: ['feature', 'action'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    });

    // Previous period aggregation (for trend comparison)
    const previousPeriod = await prisma.featureEvent.groupBy({
      by: ['feature', 'action'],
      where: {
        createdAt: { gte: previousSince, lt: since },
      },
      _count: { id: true },
    });

    // Build lookup for previous period
    const prevMap = new Map<string, number>();
    for (const row of previousPeriod) {
      const key = `${row.feature}:${row.action}`;
      prevMap.set(key, row._count.id);
    }

    // Combine into response
    const usage = currentPeriod.map((row) => {
      const key = `${row.feature}:${row.action}`;
      const prevCount = prevMap.get(key) || 0;
      const currentCount = row._count.id;
      const trend = prevCount > 0
        ? Math.round(((currentCount - prevCount) / prevCount) * 100)
        : null; // null = no previous data to compare

      return {
        feature: row.feature,
        action: row.action,
        count: currentCount,
        previousCount: prevCount,
        trend,
      };
    });

    // Sort by count descending
    usage.sort((a, b) => b.count - a.count);

    // Heatmap: usage by day of week and hour
    const heatmapRows = await prisma.$queryRaw<
      Array<{ dow: number; hour: number; count: bigint }>
    >`
      SELECT
        EXTRACT(DOW FROM created_at) AS dow,
        EXTRACT(HOUR FROM created_at) AS hour,
        COUNT(*) AS count
      FROM feature_events
      WHERE created_at >= ${since}
      GROUP BY dow, hour
      ORDER BY dow, hour
    `;

    const heatmap = heatmapRows.map((r) => ({
      dow: Number(r.dow),
      hour: Number(r.hour),
      count: Number(r.count),
    }));

    // Role breakdown
    const roleBreakdown = await prisma.featureEvent.groupBy({
      by: ['role'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    });

    const roles = roleBreakdown.map((r) => ({
      role: r.role || 'unknown',
      count: r._count.id,
    }));

    // Total events
    const totalEvents = await prisma.featureEvent.count({
      where: { createdAt: { gte: since } },
    });

    return NextResponse.json({
      usage,
      heatmap,
      roles,
      totalEvents,
      period: { days, since: since.toISOString() },
    });
  } catch (error) {
    console.error('[Tracking Report API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
