'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { useTrack } from '@/hooks/useTrack';
import {
  HiOutlineChartBarSquare,
  HiOutlineArrowTrendingUp,
  HiOutlineArrowTrendingDown,
} from 'react-icons/hi2';

interface UsageRow {
  feature: string;
  action: string;
  count: number;
  previousCount: number;
  trend: number | null;
}

interface HeatmapCell {
  dow: number;
  hour: number;
  count: number;
}

interface RoleRow {
  role: string;
  count: number;
}

const PERIOD_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatFeature(f: string) {
  return f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function FeatureUsagePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const track = useTrack('admin_feature_usage');

  const [days, setDays] = useState(30);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    const fetchReport = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/tracking/report?days=${days}`);
        if (!res.ok) throw new Error('Failed to fetch report');
        const data = await res.json();
        setUsage(data.usage || []);
        setHeatmap(data.heatmap || []);
        setRoles(data.roles || []);
        setTotalEvents(data.totalEvents || 0);
      } catch (error) {
        console.error('Failed to fetch usage report:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [session, router, days]);

  // Aggregate by feature (sum all actions)
  const featureTotals = usage.reduce<Record<string, { count: number; prev: number }>>((acc, row) => {
    if (!acc[row.feature]) acc[row.feature] = { count: 0, prev: 0 };
    acc[row.feature].count += row.count;
    acc[row.feature].prev += row.previousCount;
    return acc;
  }, {});

  const featureList = Object.entries(featureTotals)
    .map(([feature, { count, prev }]) => ({
      feature,
      count,
      trend: prev > 0 ? Math.round(((count - prev) / prev) * 100) : null,
    }))
    .sort((a, b) => b.count - a.count);

  // Heatmap max for scaling
  const heatmapMax = Math.max(1, ...heatmap.map((c) => c.count));
  const heatmapLookup = new Map(heatmap.map((c) => [`${c.dow}:${c.hour}`, c.count]));

  if (session?.user?.role !== 'ADMIN') return null;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-display-md text-ink-950 dark:text-ink-100 flex items-center gap-3">
              <HiOutlineChartBarSquare className="w-8 h-8 text-press-500" />
              Feature Usage
            </h1>
            <p className="text-ink-500 dark:text-ink-400 mt-1">
              {totalEvents.toLocaleString()} events tracked
            </p>
          </div>
          <div className="flex items-center gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setDays(opt.value);
                  track('admin_feature_usage', 'change_period', { days: opt.value });
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  days === opt.value
                    ? 'bg-ink-950 text-paper-100 dark:bg-ink-700 dark:text-ink-100'
                    : 'text-ink-500 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800 border border-ink-200 dark:border-ink-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-ink-200 border-t-press-500 rounded-full" />
          </div>
        ) : (
          <>
            {/* Role Breakdown */}
            {roles.length > 0 && (
              <div className="flex gap-4 mb-6">
                {roles.map((r) => (
                  <div
                    key={r.role}
                    className="flex-1 bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-4"
                  >
                    <p className="text-xs font-medium text-ink-400 dark:text-ink-500 uppercase tracking-wider">
                      {r.role}
                    </p>
                    <p className="text-2xl font-display font-bold text-ink-900 dark:text-ink-100 mt-1">
                      {r.count.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Feature Summary Table */}
            <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 overflow-hidden mb-8">
              <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-800">
                <h2 className="font-display font-semibold text-ink-900 dark:text-ink-100">
                  Features by Total Usage
                </h2>
              </div>
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {featureList.length === 0 ? (
                  <div className="px-5 py-8 text-center text-ink-400">
                    No usage data yet. Interact with the app to generate events.
                  </div>
                ) : (
                  featureList.map((row) => (
                    <div
                      key={row.feature}
                      className="px-5 py-3 flex items-center justify-between hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-ink-900 dark:text-ink-100">
                          {formatFeature(row.feature)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-display font-bold tabular-nums text-ink-900 dark:text-ink-100">
                          {row.count.toLocaleString()}
                        </span>
                        {row.trend !== null && (
                          <span
                            className={`flex items-center gap-1 text-sm font-medium ${
                              row.trend >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-500 dark:text-red-400'
                            }`}
                          >
                            {row.trend >= 0 ? (
                              <HiOutlineArrowTrendingUp className="w-4 h-4" />
                            ) : (
                              <HiOutlineArrowTrendingDown className="w-4 h-4" />
                            )}
                            {row.trend > 0 ? '+' : ''}
                            {row.trend}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Detailed Action Breakdown */}
            <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 overflow-hidden mb-8">
              <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-800">
                <h2 className="font-display font-semibold text-ink-900 dark:text-ink-100">
                  Detailed Actions
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 dark:border-ink-800 text-left">
                      <th className="px-5 py-3 font-medium text-ink-500 dark:text-ink-400">Feature</th>
                      <th className="px-5 py-3 font-medium text-ink-500 dark:text-ink-400">Action</th>
                      <th className="px-5 py-3 font-medium text-ink-500 dark:text-ink-400 text-right">Count</th>
                      <th className="px-5 py-3 font-medium text-ink-500 dark:text-ink-400 text-right">Prev Period</th>
                      <th className="px-5 py-3 font-medium text-ink-500 dark:text-ink-400 text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {usage.map((row, i) => (
                      <tr key={i} className="hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
                        <td className="px-5 py-2.5 font-medium text-ink-900 dark:text-ink-100">
                          {formatFeature(row.feature)}
                        </td>
                        <td className="px-5 py-2.5 text-ink-600 dark:text-ink-300">
                          {row.action}
                        </td>
                        <td className="px-5 py-2.5 text-right font-display font-bold tabular-nums text-ink-900 dark:text-ink-100">
                          {row.count.toLocaleString()}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-ink-400">
                          {row.previousCount.toLocaleString()}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          {row.trend !== null ? (
                            <span
                              className={`inline-flex items-center gap-1 text-sm font-medium ${
                                row.trend >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-500 dark:text-red-400'
                              }`}
                            >
                              {row.trend > 0 ? '+' : ''}
                              {row.trend}%
                            </span>
                          ) : (
                            <span className="text-ink-300 dark:text-ink-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Heatmap */}
            <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-800">
                <h2 className="font-display font-semibold text-ink-900 dark:text-ink-100">
                  Usage by Day & Hour
                </h2>
                <p className="text-xs text-ink-400 dark:text-ink-500 mt-1">
                  Darker = more activity (server time)
                </p>
              </div>
              <div className="p-5 overflow-x-auto">
                <div className="min-w-[640px]">
                  {/* Hour labels */}
                  <div className="flex ml-12 mb-1">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div
                        key={h}
                        className="flex-1 text-center text-[10px] text-ink-400 dark:text-ink-500"
                      >
                        {h % 3 === 0 ? `${h}` : ''}
                      </div>
                    ))}
                  </div>
                  {/* Rows */}
                  {DAY_NAMES.map((dayName, dow) => (
                    <div key={dow} className="flex items-center mb-1">
                      <div className="w-12 text-xs text-ink-500 dark:text-ink-400 font-medium">
                        {dayName}
                      </div>
                      <div className="flex flex-1 gap-px">
                        {Array.from({ length: 24 }, (_, hour) => {
                          const count = heatmapLookup.get(`${dow}:${hour}`) || 0;
                          const intensity = count / heatmapMax;
                          return (
                            <div
                              key={hour}
                              className="flex-1 h-6 rounded-sm transition-colors"
                              style={{
                                backgroundColor:
                                  count === 0
                                    ? 'var(--color-ink-100, #f1f5f9)'
                                    : `rgba(99, 102, 241, ${0.15 + intensity * 0.85})`,
                              }}
                              title={`${dayName} ${hour}:00 — ${count} events`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
