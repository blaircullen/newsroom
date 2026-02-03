import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Returns daily pageview stats for sparklines
// Simulates 7-day trend data based on current totals with some variance
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const articleIds = searchParams.get('ids')?.split(',').filter(Boolean) || [];

    if (articleIds.length === 0) {
      return NextResponse.json({ stats: {} });
    }

    // Fetch current totals for the requested articles
    const articles = await prisma.article.findMany({
      where: {
        id: { in: articleIds },
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        totalPageviews: true,
        publishedAt: true,
      },
    });

    // Generate synthetic 7-day trend data
    // In production, you'd fetch this from your analytics provider
    const stats: Record<string, number[]> = {};

    for (const article of articles) {
      const total = article.totalPageviews || 0;
      const publishedAt = article.publishedAt ? new Date(article.publishedAt) : new Date();
      const daysSincePublish = Math.max(1, Math.floor((Date.now() - publishedAt.getTime()) / (24 * 60 * 60 * 1000)));

      // Generate realistic-looking trend
      // Newer articles tend to have declining curves (launch spike)
      // Older articles tend to be more stable
      const dailyAvg = Math.max(1, Math.floor(total / Math.min(daysSincePublish, 30)));
      const trend: number[] = [];

      for (let i = 6; i >= 0; i--) {
        // Add some variance (±30%)
        const variance = 0.7 + Math.random() * 0.6;
        // Recent days tend to be higher for newer articles
        const recencyBoost = daysSincePublish < 7 ? (1 + (6 - i) * 0.1) : 1;
        const value = Math.max(0, Math.round(dailyAvg * variance * recencyBoost));
        trend.push(value);
      }

      stats[article.id] = trend;
    }

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Daily stats API error:', error);
    return NextResponse.json({ error: 'Failed to fetch daily stats' }, { status: 500 });
  }
}
