'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import WriterLeaderboard from '@/components/dashboard/WriterLeaderboard';
import Sparkline from '@/components/ui/Sparkline';
import {
  HiOutlineChartBar,
  HiOutlineEye,
  HiOutlineUsers,
  HiOutlineDocumentText,
  HiOutlineArrowTrendingUp,
  HiOutlineArrowTrendingDown,
  HiOutlineCalendarDays,
} from 'react-icons/hi2';

interface ArticleStats {
  id: string;
  headline: string;
  totalPageviews: number;
  totalUniqueVisitors: number;
  publishedAt: string;
  publishedSite: string | null;
  author: { name: string };
  sparkline?: number[];
}

interface OverviewStats {
  totalArticles: number;
  totalPageviews: number;
  totalVisitors: number;
  avgPageviewsPerArticle: number;
}

interface RealtimeData {
  activeVisitors: number;
  totalRecentViews: number;
  timestamp: number;
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<'12h' | '24h' | '7d' | '30d'>('12h');
  const [articles, setArticles] = useState<ArticleStats[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [isRealtime, setIsRealtime] = useState(false);

  // Fetch real-time active visitors
  const fetchRealtime = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/analytics/realtime', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setRealtime(data);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to fetch realtime:', error);
      }
    }
  }, []);

  // Poll active visitors every 15 seconds
  useEffect(() => {
    if (!session) return;
    fetchRealtime();
    const interval = setInterval(fetchRealtime, 15000);
    return () => clearInterval(interval);
  }, [session, fetchRealtime]);

  // Fetch top articles for the selected period
  useEffect(() => {
    if (!session) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/analytics/top-articles?period=${period}`);
        const data = await res.json();

        const topArticles = data.articles || [];
        setIsRealtime(data.isRealtime || false);

        const stats: OverviewStats = {
          totalArticles: data.overview?.articlesWithTraffic || 0,
          totalPageviews: data.overview?.totalPageviews || 0,
          totalVisitors: data.overview?.totalVisitors || 0,
          avgPageviewsPerArticle: data.overview?.articlesWithTraffic > 0
            ? Math.round(data.overview.totalPageviews / data.overview.articlesWithTraffic)
            : 0,
        };
        setOverview(stats);

        // Fetch sparkline data for top articles
        const ids = topArticles.slice(0, 20).map((a: { id: string }) => a.id).join(',');
        if (ids) {
          const sparkRes = await fetch(`/api/analytics/daily-stats?ids=${ids}`);
          const sparkData = await sparkRes.json();

          const articlesWithSparklines = topArticles.map((a: ArticleStats & { recentPageviews?: number }) => ({
            ...a,
            totalPageviews: a.recentPageviews ?? a.totalPageviews,
            sparkline: sparkData.stats?.[a.id] || [],
          }));

          setArticles(articlesWithSparklines);
        } else {
          setArticles(topArticles.map((a: ArticleStats & { recentPageviews?: number }) => ({
            ...a,
            totalPageviews: a.recentPageviews ?? a.totalPageviews,
          })));
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [period, session]);

  if (!session) return null;

  const isLive = realtime && (Date.now() - realtime.timestamp) < 30000;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-display text-display-md text-ink-950 dark:text-white">
                Performance Hub
              </h1>
              <p className="text-ink-400 mt-1">
                {isRealtime ? 'Live analytics from Umami' : 'Analytics and insights for your content'}
              </p>
            </div>
            {isLive && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-ink-800 rounded-lg border border-ink-200 dark:border-ink-700 p-1">
            {([
              { value: '12h', label: '12H' },
              { value: '24h', label: 'Day' },
              { value: '7d', label: 'Week' },
              { value: '30d', label: 'Month' },
            ] as const).map((option) => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === option.value
                    ? 'bg-ink-900 dark:bg-ink-700 text-white'
                    : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-300'
                }`}
              >
                {option.label}
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
            {/* Overview Cards */}
            <div className="grid grid-cols-5 gap-4 mb-8">
              {/* Active Visitors - live */}
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                  </span>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/20 mb-3">
                  <HiOutlineEye className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xl font-display font-bold text-white">
                  {realtime?.activeVisitors ?? '—'}
                </p>
                <p className="text-sm text-white/80 mt-0.5">Active Now</p>
              </div>

              <OverviewCard
                icon={HiOutlineDocumentText}
                label="With Traffic"
                value={overview?.totalArticles || 0}
                color="ink"
              />
              <OverviewCard
                icon={HiOutlineChartBar}
                label="Pageviews"
                value={overview?.totalPageviews || 0}
                color="press"
              />
              <OverviewCard
                icon={HiOutlineUsers}
                label="Visitors"
                value={overview?.totalVisitors || 0}
                color="blue"
              />
              <OverviewCard
                icon={HiOutlineArrowTrendingUp}
                label="Avg / Article"
                value={overview?.avgPageviewsPerArticle || 0}
                color="emerald"
              />
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Top Articles */}
              <div className="col-span-2">
                <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
                    <div>
                      <h2 className="font-display font-semibold text-ink-900 dark:text-white">
                        Top Performing Articles
                      </h2>
                      <p className="text-xs text-ink-400 mt-0.5">
                        Ranked by pageviews in the last {period === '12h' ? '12 hours' : period === '24h' ? '24 hours' : period === '7d' ? '7 days' : '30 days'}
                      </p>
                    </div>
                    {isRealtime && (
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full uppercase tracking-wider">
                        Umami Live
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-ink-100 dark:divide-ink-800">
                    {articles.length > 0 ? (
                      articles.slice(0, 10).map((article, index) => (
                        <div
                          key={article.id}
                          className="flex items-center gap-4 px-5 py-4 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors cursor-pointer"
                          onClick={() => router.push(`/editor/${article.id}`)}
                        >
                          {/* Rank */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                            index < 3
                              ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                              : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400'
                          }`}>
                            {index + 1}
                          </div>

                          {/* Article info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-ink-900 dark:text-white truncate">
                              {article.headline}
                            </p>
                            <p className="text-xs text-ink-400 mt-0.5">
                              by {article.author.name} · {new Date(article.publishedAt).toLocaleDateString()}
                            </p>
                          </div>

                          {/* Sparkline */}
                          {article.sparkline && article.sparkline.length > 0 && (
                            <div className="flex-shrink-0">
                              <Sparkline
                                data={article.sparkline}
                                width={80}
                                height={28}
                                showDots
                              />
                            </div>
                          )}

                          {/* Stats */}
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-ink-900 dark:text-white">
                              {article.totalPageviews.toLocaleString()}
                            </p>
                            <p className="text-xs text-ink-400">pageviews</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-5 py-12 text-center">
                        <HiOutlineChartBar className="w-8 h-8 text-ink-300 dark:text-ink-600 mx-auto mb-2" />
                        <p className="text-ink-500 dark:text-ink-400 font-medium">No traffic in this period</p>
                        <p className="text-xs text-ink-400 dark:text-ink-500 mt-1">Try a longer time range</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <WriterLeaderboard />

                {/* Quick Stats */}
                <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-5">
                  <h3 className="font-display font-semibold text-ink-900 dark:text-white mb-4">
                    Publishing Velocity
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink-500 dark:text-ink-400">This week</span>
                      <span className="font-semibold text-ink-900 dark:text-white">
                        {articles.filter(a => {
                          const published = new Date(a.publishedAt);
                          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                          return published >= weekAgo;
                        }).length} articles
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink-500 dark:text-ink-400">This month</span>
                      <span className="font-semibold text-ink-900 dark:text-white">
                        {articles.filter(a => {
                          const published = new Date(a.publishedAt);
                          const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                          return published >= monthAgo;
                        }).length} articles
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    ink: 'bg-ink-50 dark:bg-ink-800 text-ink-600 dark:text-ink-400',
    press: 'bg-press-50 dark:bg-press-900/30 text-press-600 dark:text-press-400',
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]} mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-display font-bold text-ink-900 dark:text-white">
        {value.toLocaleString()}
      </p>
      <p className="text-sm text-ink-400 mt-0.5">{label}</p>
    </div>
  );
}
