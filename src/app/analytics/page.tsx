'use client';

import { useState, useEffect } from 'react';
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

interface SiteStats {
  site: string;
  articleCount: number;
  totalPageviews: number;
  totalVisitors: number;
}

interface OverviewStats {
  totalArticles: number;
  totalPageviews: number;
  totalVisitors: number;
  avgPageviewsPerArticle: number;
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [articles, setArticles] = useState<ArticleStats[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [siteStats, setSiteStats] = useState<SiteStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch published articles
        const res = await fetch('/api/articles?status=PUBLISHED&limit=100&sortBy=pageviews');
        const data = await res.json();
        const publishedArticles = data.articles || [];

        // Calculate overview stats
        const stats: OverviewStats = {
          totalArticles: publishedArticles.length,
          totalPageviews: publishedArticles.reduce((sum: number, a: ArticleStats) => sum + (a.totalPageviews || 0), 0),
          totalVisitors: publishedArticles.reduce((sum: number, a: ArticleStats) => sum + (a.totalUniqueVisitors || 0), 0),
          avgPageviewsPerArticle: 0,
        };
        stats.avgPageviewsPerArticle = stats.totalArticles > 0
          ? Math.round(stats.totalPageviews / stats.totalArticles)
          : 0;

        setOverview(stats);

        // Calculate site-by-site stats
        const siteMap = new Map<string, SiteStats>();
        publishedArticles.forEach((a: ArticleStats) => {
          const site = a.publishedSite || 'Unknown';
          const existing = siteMap.get(site);
          if (existing) {
            existing.articleCount++;
            existing.totalPageviews += a.totalPageviews || 0;
            existing.totalVisitors += a.totalUniqueVisitors || 0;
          } else {
            siteMap.set(site, {
              site,
              articleCount: 1,
              totalPageviews: a.totalPageviews || 0,
              totalVisitors: a.totalUniqueVisitors || 0,
            });
          }
        });
        const sortedSiteStats = Array.from(siteMap.values()).sort((a, b) => b.totalPageviews - a.totalPageviews);
        setSiteStats(sortedSiteStats);

        // Fetch sparkline data
        const ids = publishedArticles.slice(0, 20).map((a: ArticleStats) => a.id).join(',');
        if (ids) {
          const sparkRes = await fetch(`/api/analytics/daily-stats?ids=${ids}`);
          const sparkData = await sparkRes.json();

          const articlesWithSparklines = publishedArticles.map((a: ArticleStats) => ({
            ...a,
            sparkline: sparkData.stats?.[a.id] || [],
          }));

          setArticles(articlesWithSparklines);
        } else {
          setArticles(publishedArticles);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dateRange, session]);

  if (!session) return null;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-display-md text-ink-950 dark:text-white">
              Performance Hub
            </h1>
            <p className="text-ink-400 mt-1">
              Analytics and insights for your content
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-ink-800 rounded-lg border border-ink-200 dark:border-ink-700 p-1">
            {(['7d', '30d', '90d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  dateRange === range
                    ? 'bg-ink-900 dark:bg-ink-700 text-white'
                    : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-300'
                }`}
              >
                {range === 'all' ? 'All Time' : range.toUpperCase()}
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
            <div className="grid grid-cols-4 gap-4 mb-8">
              <OverviewCard
                icon={HiOutlineDocumentText}
                label="Published Articles"
                value={overview?.totalArticles || 0}
                color="ink"
              />
              <OverviewCard
                icon={HiOutlineChartBar}
                label="Total Pageviews"
                value={overview?.totalPageviews || 0}
                color="press"
              />
              <OverviewCard
                icon={HiOutlineUsers}
                label="Total Visitors"
                value={overview?.totalVisitors || 0}
                color="blue"
              />
              <OverviewCard
                icon={HiOutlineArrowTrendingUp}
                label="Avg per Article"
                value={overview?.avgPageviewsPerArticle || 0}
                color="emerald"
              />
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Top Articles */}
              <div className="col-span-2">
                <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-800">
                    <h2 className="font-display font-semibold text-ink-900 dark:text-white">
                      Top Performing Articles
                    </h2>
                  </div>
                  <div className="divide-y divide-ink-100 dark:divide-ink-800">
                    {articles.slice(0, 10).map((article, index) => (
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
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <WriterLeaderboard />

                {/* Site Performance */}
                {siteStats.length > 0 && (
                  <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-5">
                    <h3 className="font-display font-semibold text-ink-900 dark:text-white mb-4">
                      Performance by Site
                    </h3>
                    <div className="space-y-3">
                      {siteStats.map((site) => (
                        <div key={site.site} className="pb-3 border-b border-ink-100 dark:border-ink-800 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-ink-900 dark:text-white truncate">
                              {site.site}
                            </span>
                            <span className="text-xs text-ink-400 flex-shrink-0 ml-2">
                              {site.articleCount} articles
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-ink-500 dark:text-ink-400">
                              <span className="font-semibold text-ink-700 dark:text-ink-200">{site.totalPageviews.toLocaleString()}</span> views
                            </span>
                            <span className="text-ink-500 dark:text-ink-400">
                              <span className="font-semibold text-ink-700 dark:text-ink-200">{site.totalVisitors.toLocaleString()}</span> visitors
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
