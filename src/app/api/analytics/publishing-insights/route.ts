import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { utcToET } from '@/lib/date-utils';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MIN_ARTICLES_FOR_INSIGHTS = 25;

interface Aggregation {
  totalPV: number;
  totalVisitors: number;
  count: number;
}

interface DayInsight {
  day: number;
  dayName: string;
  articleCount: number;
  avgPageviews: number;
  avgVisitors: number;
}

interface HourInsight {
  hour: number;
  displayHour: string;
  articleCount: number;
  avgPageviews: number;
  avgVisitors: number;
}

interface HeatmapCell {
  day: number;
  hour: number;
  articleCount: number;
  avgPageviews: number;
  intensity: number;
}

interface SiteInsights {
  site: string;
  sampleSize: number;
  hasEnoughData: boolean;
  bestDays: DayInsight[];
  bestHours: HourInsight[];
  heatmap: HeatmapCell[][];
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '90d';

    // Calculate date filter
    let dateFilter: Date | undefined;
    if (period === '30d') {
      dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === '90d') {
      dateFilter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    }
    // 'all' = no date filter

    // Fetch all published articles with analytics
    const articles = await prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: {
          not: null,
          ...(dateFilter && { gte: dateFilter }),
        },
        publishedSite: { not: null },
      },
      select: {
        publishedAt: true,
        publishedSite: true,
        totalPageviews: true,
        totalUniqueVisitors: true,
      },
    });

    // Group by site (split pipe-delimited multi-site values into individual sites)
    const siteGroups: Record<string, typeof articles> = {};
    for (const article of articles) {
      const sites = article.publishedSite!.split(' | ').map(s => s.trim()).filter(Boolean);
      for (const site of sites) {
        if (!siteGroups[site]) siteGroups[site] = [];
        siteGroups[site].push(article);
      }
    }

    // Process each site
    const sites: SiteInsights[] = [];

    for (const [site, siteArticles] of Object.entries(siteGroups)) {
      // Initialize aggregation structures
      const dayAgg: Record<number, Aggregation> = {};
      const hourAgg: Record<number, Aggregation> = {};
      const heatmapAgg: Aggregation[][] = Array(7)
        .fill(null)
        .map(() =>
          Array(24)
            .fill(null)
            .map(() => ({ totalPV: 0, totalVisitors: 0, count: 0 }))
        );

      // Aggregate data (convert to Eastern Time for accurate day/hour)
      for (const article of siteArticles) {
        const pubDate = utcToET(new Date(article.publishedAt!));
        const day = pubDate.getDay(); // 0-6 in ET
        const hour = pubDate.getHours(); // 0-23 in ET
        const pv = article.totalPageviews || 0;
        const visitors = article.totalUniqueVisitors || 0;

        // Aggregate by day
        if (!dayAgg[day]) dayAgg[day] = { totalPV: 0, totalVisitors: 0, count: 0 };
        dayAgg[day].totalPV += pv;
        dayAgg[day].totalVisitors += visitors;
        dayAgg[day].count++;

        // Aggregate by hour
        if (!hourAgg[hour]) hourAgg[hour] = { totalPV: 0, totalVisitors: 0, count: 0 };
        hourAgg[hour].totalPV += pv;
        hourAgg[hour].totalVisitors += visitors;
        hourAgg[hour].count++;

        // Aggregate for heatmap
        heatmapAgg[day][hour].totalPV += pv;
        heatmapAgg[day][hour].totalVisitors += visitors;
        heatmapAgg[day][hour].count++;
      }

      // Find max avgPageviews for heatmap normalization
      let maxAvgPV = 0;
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          const cell = heatmapAgg[d][h];
          if (cell.count > 0) {
            const avg = cell.totalPV / cell.count;
            if (avg > maxAvgPV) maxAvgPV = avg;
          }
        }
      }

      // Build best days array
      const bestDays: DayInsight[] = [];
      for (let d = 0; d < 7; d++) {
        const agg = dayAgg[d] || { totalPV: 0, totalVisitors: 0, count: 0 };
        bestDays.push({
          day: d,
          dayName: DAY_NAMES[d],
          articleCount: agg.count,
          avgPageviews: agg.count > 0 ? Math.round(agg.totalPV / agg.count) : 0,
          avgVisitors: agg.count > 0 ? Math.round(agg.totalVisitors / agg.count) : 0,
        });
      }
      bestDays.sort((a, b) => b.avgPageviews - a.avgPageviews);

      // Build best hours array
      const bestHours: HourInsight[] = [];
      for (let h = 0; h < 24; h++) {
        const agg = hourAgg[h] || { totalPV: 0, totalVisitors: 0, count: 0 };
        bestHours.push({
          hour: h,
          displayHour: formatHour(h),
          articleCount: agg.count,
          avgPageviews: agg.count > 0 ? Math.round(agg.totalPV / agg.count) : 0,
          avgVisitors: agg.count > 0 ? Math.round(agg.totalVisitors / agg.count) : 0,
        });
      }
      bestHours.sort((a, b) => b.avgPageviews - a.avgPageviews);

      // Build heatmap with normalized intensity
      const heatmap: HeatmapCell[][] = heatmapAgg.map((dayRow, d) =>
        dayRow.map((cell, h) => ({
          day: d,
          hour: h,
          articleCount: cell.count,
          avgPageviews: cell.count > 0 ? Math.round(cell.totalPV / cell.count) : 0,
          intensity: maxAvgPV > 0 && cell.count > 0 ? (cell.totalPV / cell.count) / maxAvgPV : 0,
        }))
      );

      sites.push({
        site,
        sampleSize: siteArticles.length,
        hasEnoughData: siteArticles.length >= MIN_ARTICLES_FOR_INSIGHTS,
        bestDays,
        bestHours,
        heatmap,
      });
    }

    // Sort sites by name for consistent ordering
    sites.sort((a, b) => a.site.localeCompare(b.site));

    return NextResponse.json({
      sites,
      period,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Publishing insights API error:', error);
    return NextResponse.json({ error: 'Failed to fetch publishing insights' }, { status: 500 });
  }
}
