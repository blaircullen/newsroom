'use client';

import { useState, useEffect } from 'react';
import {
  HiOutlineChartBarSquare,
  HiOutlineSparkles,
} from 'react-icons/hi2';

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

interface PublishingInsightsResponse {
  sites: SiteInsights[];
  period: string;
  generatedAt: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = [0, 6, 12, 18];

export default function PublishingInsights() {
  const [data, setData] = useState<PublishingInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [period, setPeriod] = useState<'30d' | '90d' | 'all'>('90d');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/analytics/publishing-insights?period=${period}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error('Failed to fetch publishing insights:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [period]);

  // Get current site data or aggregate all sites
  const currentSiteData = (): SiteInsights | null => {
    if (!data) return null;

    if (selectedSite === 'all') {
      // Aggregate all sites
      const allDayAgg: Record<number, { totalPV: number; count: number }> = {};
      const allHourAgg: Record<number, { totalPV: number; count: number }> = {};
      const allHeatmapAgg: { totalPV: number; count: number }[][] = Array(7)
        .fill(null)
        .map(() => Array(24).fill(null).map(() => ({ totalPV: 0, count: 0 })));

      let totalArticles = 0;

      for (const site of data.sites) {
        totalArticles += site.sampleSize;

        // Aggregate days
        for (const day of site.bestDays) {
          if (!allDayAgg[day.day]) allDayAgg[day.day] = { totalPV: 0, count: 0 };
          allDayAgg[day.day].totalPV += day.avgPageviews * day.articleCount;
          allDayAgg[day.day].count += day.articleCount;
        }

        // Aggregate hours
        for (const hour of site.bestHours) {
          if (!allHourAgg[hour.hour]) allHourAgg[hour.hour] = { totalPV: 0, count: 0 };
          allHourAgg[hour.hour].totalPV += hour.avgPageviews * hour.articleCount;
          allHourAgg[hour.hour].count += hour.articleCount;
        }

        // Aggregate heatmap
        for (let d = 0; d < 7; d++) {
          for (let h = 0; h < 24; h++) {
            const cell = site.heatmap[d][h];
            allHeatmapAgg[d][h].totalPV += cell.avgPageviews * cell.articleCount;
            allHeatmapAgg[d][h].count += cell.articleCount;
          }
        }
      }

      // Calculate max for normalization
      let maxAvgPV = 0;
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          const cell = allHeatmapAgg[d][h];
          if (cell.count > 0) {
            const avg = cell.totalPV / cell.count;
            if (avg > maxAvgPV) maxAvgPV = avg;
          }
        }
      }

      // Build aggregated data
      const bestDays: DayInsight[] = [];
      for (let d = 0; d < 7; d++) {
        const agg = allDayAgg[d] || { totalPV: 0, count: 0 };
        bestDays.push({
          day: d,
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d],
          articleCount: agg.count,
          avgPageviews: agg.count > 0 ? Math.round(agg.totalPV / agg.count) : 0,
          avgVisitors: 0,
        });
      }
      bestDays.sort((a, b) => b.avgPageviews - a.avgPageviews);

      const bestHours: HourInsight[] = [];
      for (let h = 0; h < 24; h++) {
        const agg = allHourAgg[h] || { totalPV: 0, count: 0 };
        bestHours.push({
          hour: h,
          displayHour: formatHour(h),
          articleCount: agg.count,
          avgPageviews: agg.count > 0 ? Math.round(agg.totalPV / agg.count) : 0,
          avgVisitors: 0,
        });
      }
      bestHours.sort((a, b) => b.avgPageviews - a.avgPageviews);

      const heatmap: HeatmapCell[][] = allHeatmapAgg.map((dayRow, d) =>
        dayRow.map((cell, h) => ({
          day: d,
          hour: h,
          articleCount: cell.count,
          avgPageviews: cell.count > 0 ? Math.round(cell.totalPV / cell.count) : 0,
          intensity: maxAvgPV > 0 && cell.count > 0 ? (cell.totalPV / cell.count) / maxAvgPV : 0,
        }))
      );

      return {
        site: 'All Sites',
        sampleSize: totalArticles,
        hasEnoughData: totalArticles >= 25,
        bestDays,
        bestHours,
        heatmap,
      };
    }

    return data.sites.find((s) => s.site === selectedSite) || null;
  };

  const siteData = currentSiteData();
  const availableSites = data?.sites.map((s) => s.site) || [];

  return (
    <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-ink-100 dark:border-ink-800">
        <div className="flex items-center gap-2">
          <HiOutlineSparkles className="w-5 h-5 text-press-500" />
          <h3 className="font-display font-semibold text-ink-900 dark:text-white">
            Publishing Insights
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Period Selector */}
        <div className="flex bg-ink-100 dark:bg-ink-800 rounded-lg p-1">
          {(['30d', '90d', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-white shadow-sm'
                  : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-300'
              }`}
            >
              {p === 'all' ? 'All Time' : p.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Site Selector */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSelectedSite('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
              selectedSite === 'all'
                ? 'bg-press-100 dark:bg-press-900/30 text-press-700 dark:text-press-300'
                : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700'
            }`}
          >
            All Sites
          </button>
          {availableSites.map((site) => (
            <button
              key={site}
              onClick={() => setSelectedSite(site)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                selectedSite === site
                  ? 'bg-press-100 dark:bg-press-900/30 text-press-700 dark:text-press-300'
                  : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700'
              }`}
            >
              {site.replace('.com', '')}
            </button>
          ))}
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : !siteData ? (
          <div className="text-center py-8 text-ink-500 dark:text-ink-400 text-sm">
            No data available
          </div>
        ) : !siteData.hasEnoughData ? (
          <InsufficientDataMessage sampleSize={siteData.sampleSize} />
        ) : (
          <>
            {/* Sample Size */}
            <div className="text-xs text-ink-400 dark:text-ink-500">
              Based on {siteData.sampleSize} published articles
            </div>

            {/* Best Days */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">
                Best Days to Publish
              </h4>
              {siteData.bestDays.slice(0, 3).map((day, i) => (
                <div key={day.day} className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : i === 1
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-ink-900 dark:text-white">
                    {day.dayName}
                  </span>
                  <span className="text-sm text-ink-500 dark:text-ink-400">
                    {day.avgPageviews.toLocaleString()} avg
                  </span>
                </div>
              ))}
            </div>

            {/* Best Hours */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">
                Best Hours to Publish
              </h4>
              {siteData.bestHours.slice(0, 3).map((hour, i) => (
                <div key={hour.hour} className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0
                        ? 'bg-press-100 text-press-700 dark:bg-press-900/30 dark:text-press-300'
                        : i === 1
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-ink-900 dark:text-white">
                    {hour.displayHour}
                  </span>
                  <span className="text-sm text-ink-500 dark:text-ink-400">
                    {hour.avgPageviews.toLocaleString()} avg
                  </span>
                </div>
              ))}
            </div>

            {/* Heatmap */}
            <PublishingHeatmap heatmap={siteData.heatmap} />
          </>
        )}
      </div>
    </div>
  );
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 w-32 bg-ink-100 dark:bg-ink-800 rounded" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-ink-100 dark:bg-ink-800" />
            <div className="flex-1 h-4 bg-ink-100 dark:bg-ink-800 rounded" />
            <div className="w-16 h-4 bg-ink-100 dark:bg-ink-800 rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-ink-100 dark:bg-ink-800" />
            <div className="flex-1 h-4 bg-ink-100 dark:bg-ink-800 rounded" />
            <div className="w-16 h-4 bg-ink-100 dark:bg-ink-800 rounded" />
          </div>
        ))}
      </div>
      <div className="h-40 bg-ink-100 dark:bg-ink-800 rounded" />
    </div>
  );
}

function InsufficientDataMessage({ sampleSize }: { sampleSize: number }) {
  const progress = Math.min(100, (sampleSize / 25) * 100);
  const needed = Math.max(0, 25 - sampleSize);

  return (
    <div className="text-center py-8 px-4">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
        <HiOutlineChartBarSquare className="w-6 h-6 text-ink-400" />
      </div>
      <h4 className="text-sm font-medium text-ink-900 dark:text-white mb-1">
        Not Enough Data
      </h4>
      <p className="text-xs text-ink-500 dark:text-ink-400 max-w-[200px] mx-auto">
        We need at least 25 published articles to generate reliable insights.
        Currently: {sampleSize} article{sampleSize !== 1 ? 's' : ''}.
      </p>
      <div className="mt-3 w-full bg-ink-100 dark:bg-ink-800 rounded-full h-2">
        <div
          className="bg-press-500 h-2 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[10px] text-ink-400 mt-1">{needed} more needed</p>
    </div>
  );
}

function PublishingHeatmap({ heatmap }: { heatmap: HeatmapCell[][] }) {
  const cellWidth = 10;
  const cellHeight = 14;
  const cellGap = 1;
  const labelWidth = 24;
  const labelHeight = 12;

  const width = labelWidth + 24 * (cellWidth + cellGap);
  const height = labelHeight + 7 * (cellHeight + cellGap);

  const getColor = (intensity: number) => {
    if (intensity === 0) {
      return 'var(--heatmap-empty)';
    }
    const alpha = Math.max(0.15, Math.min(1, intensity));
    return `rgba(212, 43, 43, ${alpha})`;
  };

  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider mb-2">
        Performance Heatmap
      </h4>
      <style jsx>{`
        :root {
          --heatmap-empty: #f3f4f6;
        }
        :global(.dark) {
          --heatmap-empty: #1f2937;
        }
      `}</style>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label="Publishing performance heatmap"
      >
        {/* Hour labels */}
        {HOUR_LABELS.map((hour) => (
          <text
            key={`hour-${hour}`}
            x={labelWidth + hour * (cellWidth + cellGap) + cellWidth / 2}
            y={labelHeight - 3}
            textAnchor="middle"
            className="text-[6px] fill-ink-400 dark:fill-ink-500"
          >
            {hour === 0 ? '12a' : hour === 12 ? '12p' : hour < 12 ? `${hour}a` : `${hour - 12}p`}
          </text>
        ))}

        {/* Day rows */}
        {DAY_LABELS.map((dayLabel, dayIndex) => (
          <g key={dayLabel}>
            {/* Day label */}
            <text
              x={labelWidth - 3}
              y={labelHeight + dayIndex * (cellHeight + cellGap) + cellHeight / 2 + 3}
              textAnchor="end"
              className="text-[6px] fill-ink-400 dark:fill-ink-500"
            >
              {dayLabel}
            </text>

            {/* Hour cells */}
            {Array.from({ length: 24 }, (_, hourIndex) => {
              const cell = heatmap[dayIndex][hourIndex];
              return (
                <rect
                  key={`${dayIndex}-${hourIndex}`}
                  x={labelWidth + hourIndex * (cellWidth + cellGap)}
                  y={labelHeight + dayIndex * (cellHeight + cellGap)}
                  width={cellWidth}
                  height={cellHeight}
                  rx={2}
                  fill={getColor(cell.intensity)}
                  className="transition-colors"
                >
                  <title>
                    {DAY_LABELS[dayIndex]} {formatHour(hourIndex)}: {cell.avgPageviews.toLocaleString()} avg ({cell.articleCount} articles)
                  </title>
                </rect>
              );
            })}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-2">
        <span className="text-[10px] text-ink-400">Less</span>
        <div className="flex gap-0.5">
          {[0.2, 0.4, 0.6, 0.8, 1].map((intensity) => (
            <div
              key={intensity}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: `rgba(212, 43, 43, ${intensity * 0.8})` }}
            />
          ))}
        </div>
        <span className="text-[10px] text-ink-400">More</span>
      </div>
    </div>
  );
}
