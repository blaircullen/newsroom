'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  HiOutlineEye,
  HiOutlineChartBar,
  HiOutlineFire,
  HiArrowTrendingUp,
  HiArrowTrendingDown,
  HiMinus,
} from 'react-icons/hi2';
import type { Article } from './ArticleCard';

interface RevenueSource {
  daily: number;
  monthly: number;
}

interface RevenueData {
  sources: {
    adsense: RevenueSource;
    amazon: RevenueSource;
    revcontent: RevenueSource;
  };
  total: {
    daily: number;
    monthly: number;
    yesterdayTotal: number;
    lastMonthTotal: number;
  };
  lastScraped: string;
}

interface AnalyticsSectionProps {
  stats: {
    total: number;
    published: number;
    drafts: number;
    totalViews: number;
  };
  articles: Article[];
  userEmail?: string;
}

interface RealtimeData {
  activeVisitors: number;
  recentViews: {
    id: string;
    headline: string;
    views: number;
    trend?: 'up' | 'down' | 'same' | 'new';
    trendValue?: number;
  }[];
  totalRecentViews: number;
  timestamp: number;
}

export default function AnalyticsSection({ stats, articles, userEmail }: AnalyticsSectionProps) {
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);

  const fetchRealtime = useCallback(async () => {
    try {
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const res = await fetch('/api/analytics/realtime', {
        signal: controller.signal,
        // Enable browser caching
        cache: 'default',
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setRealtime(data);
        setLastUpdate(new Date());
        // Cache in sessionStorage for instant subsequent loads
        sessionStorage.setItem('analytics_realtime', JSON.stringify(data));
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to fetch realtime data:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Try to load from sessionStorage first for instant display
    const cached = sessionStorage.getItem('analytics_realtime');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        setRealtime(data);
        setIsLoading(false);
      } catch {
        // Invalid cache, ignore
      }
    }

    fetchRealtime();
    // Refresh every 15 seconds (slightly longer for better battery life)
    const interval = setInterval(fetchRealtime, 15000);
    return () => clearInterval(interval);
  }, [fetchRealtime]);

  // Fetch revenue data (admin only)
  useEffect(() => {
    if (userEmail !== 'admin@m3media.com') return;
    const fetchRevenue = async () => {
      try {
        const res = await fetch('/api/analytics/revenue');
        if (res.ok) setRevenue(await res.json());
      } catch { /* silent */ }
    };
    fetchRevenue();
    const interval = setInterval(fetchRevenue, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userEmail]);

  // Fallback to all-time top articles if no recent data
  const publishedArticles = articles.filter(a => a.status === 'PUBLISHED');
  const fallbackTopArticles = publishedArticles
    .sort((a, b) => (b.totalPageviews || 0) - (a.totalPageviews || 0))
    .slice(0, 5);

  const displayArticles = realtime?.recentViews?.length
    ? realtime.recentViews
    : fallbackTopArticles.map(a => ({ id: a.id, headline: a.headline, views: a.totalPageviews || 0 }));

  const isLive = realtime && (Date.now() - realtime.timestamp) < 30000;

  return (
    <div className="bg-slate-900 min-h-screen px-4 pt-4 pb-32">
      {/* Header with Live indicator */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-xs text-white/50 mt-0.5">Your content performance</p>
        </div>
        {isLive && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Live</span>
          </div>
        )}
      </div>

      {/* Live Readers Hero */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 mb-6 border border-white/10 relative overflow-hidden">
        {/* Animated glow effect */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-emerald-500 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className={`text-6xl font-bold text-white tabular-nums transition-opacity ${isLoading && !realtime ? 'opacity-50' : ''}`}>
              {realtime?.activeVisitors ?? '—'}
            </span>
          </div>
          <p className="text-white/60 text-sm">
            active across all sites
          </p>
        </div>
      </div>


      {/* Revenue Card - admin only */}
      {revenue && userEmail === 'admin@m3media.com' && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 mb-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HiOutlineChartBar className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Revenue Today</h2>
            </div>
            {revenue.lastScraped && (
              <span className="text-[10px] text-white/30">{revenue.lastScraped}</span>
            )}
          </div>

          {/* Total daily */}
          <div className="text-center mb-4">
            <span className="text-4xl font-bold text-white tabular-nums">
              ${revenue.total.daily.toFixed(2)}
            </span>
            {(() => {
              const pctChange = revenue.total.yesterdayTotal > 0
                ? ((revenue.total.daily - revenue.total.yesterdayTotal) / revenue.total.yesterdayTotal * 100)
                : revenue.total.daily > 0 ? 100 : 0;
              const isUp = revenue.total.daily >= revenue.total.yesterdayTotal;
              return (
                <>
                  <div className="flex items-center justify-center gap-2 mt-1.5">
                    <span className={`text-xs font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isUp ? '▲' : '▼'} {Math.abs(pctChange).toFixed(0)}%
                    </span>
                    <span className="text-xs text-white/30">vs yesterday</span>
                  </div>
                  <p className="text-sm font-medium text-white/50 mt-1.5">
                    Yesterday: ${revenue.total.yesterdayTotal.toFixed(2)}
                  </p>
                </>
              );
            })()}
          </div>

          {/* Source breakdown */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'adsense' as const, label: 'AdSense', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
              { key: 'revcontent' as const, label: 'RevContent', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
              { key: 'amazon' as const, label: 'Amazon', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
            ]).map(({ key, label, color, bg, border }) => (
              <div key={key} className={`rounded-xl p-3 ${bg} border ${border}`}>
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-base font-bold tabular-nums ${color}`}>${revenue.sources[key].daily.toFixed(2)}</p>
                <p className="text-[10px] text-white/30 mt-0.5">${revenue.sources[key].monthly.toFixed(0)}/mo</p>
              </div>
            ))}
          </div>

          {/* Monthly progress */}
          <div className="mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/40 uppercase tracking-wide font-semibold">This Month</span>
              <span className="text-sm font-bold text-white">${revenue.total.monthly.toFixed(2)}</span>
            </div>
            {(() => {
              const target = revenue.total.lastMonthTotal > 0 ? revenue.total.lastMonthTotal : 400;
              const pct = Math.min((revenue.total.monthly / target) * 100, 100);
              return (
                <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-1000"
                    style={{ width: `${pct.toFixed(1)}%` }}
                  />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Hot Right Now Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HiOutlineFire className="w-5 h-5 text-orange-500" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              {realtime?.recentViews?.length ? 'Hot Right Now' : 'Top Performers'}
            </h2>
          </div>
          <span className="text-xs text-white/40">
            {realtime?.recentViews?.length ? 'Last 30 min' : 'All-time'}
          </span>
        </div>

        {isLoading && !realtime ? (
          // Skeleton loading state
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="backdrop-blur rounded-2xl p-4 bg-white/5 border border-white/10 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10" />
                  <div className="flex-1">
                    <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-white/10 rounded w-1/2" />
                  </div>
                  <div className="w-12 h-6 bg-white/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : displayArticles.length > 0 ? (
          <div className="space-y-3">
            {displayArticles.slice(0, 5).map((article, index) => (
              <Link key={article.id} href={`/editor/${article.id}`}>
                <div className="group active:scale-[0.98] transition-transform">
                  <div className={`
                    backdrop-blur rounded-2xl p-4 transition-all border
                    ${index === 0 && realtime?.recentViews?.length
                      ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }
                  `}>
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className={`
                        flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                        ${index === 0 ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white' :
                          index === 1 ? 'bg-white/10 text-white/80' :
                          index === 2 ? 'bg-white/10 text-white/60' :
                          'bg-white/5 text-white/40'}
                      `}>
                        {index + 1}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-white leading-snug line-clamp-2">
                          {article.headline}
                        </h3>
                      </div>

                      {/* Views and Trend */}
                      <div className="flex-shrink-0 text-right">
                        <div className={`flex items-center gap-1.5 ${
                          index === 0 && realtime?.recentViews?.length ? 'text-orange-400' : 'text-cyan-400'
                        }`}>
                          <span className="text-base font-bold tabular-nums">
                            {article.views.toLocaleString()}
                          </span>
                          <HiOutlineEye className="w-4 h-4 opacity-60" />
                        </div>
                        {/* Trend indicator */}
                        {realtime?.recentViews?.length && 'trend' in article && (
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {(article as RealtimeData['recentViews'][0]).trend === 'up' && (
                              <>
                                <HiArrowTrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[10px] text-emerald-400 font-medium">+{(article as RealtimeData['recentViews'][0]).trendValue}</span>
                              </>
                            )}
                            {(article as RealtimeData['recentViews'][0]).trend === 'down' && (
                              <>
                                <HiArrowTrendingDown className="w-3.5 h-3.5 text-red-400" />
                                <span className="text-[10px] text-red-400 font-medium">-{(article as RealtimeData['recentViews'][0]).trendValue}</span>
                              </>
                            )}
                            {(article as RealtimeData['recentViews'][0]).trend === 'same' && (
                              <HiMinus className="w-3.5 h-3.5 text-white/30" />
                            )}
                            {(article as RealtimeData['recentViews'][0]).trend === 'new' && (
                              <span className="text-[10px] text-yellow-400 font-medium">NEW</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="pt-8 text-center">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 blur-xl bg-cyan-500/10 rounded-full scale-150" />
              <div className="relative w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <HiOutlineChartBar className="w-8 h-8 text-cyan-500/50" />
              </div>
            </div>
            <p className="text-white font-medium">No analytics yet</p>
            <p className="text-sm text-white/50 mt-1">Publish your first story to see performance</p>
          </div>
        )}
      </div>

      {/* Last updated */}
      {lastUpdate && (
        <p className="text-center text-xs text-white/30 mt-6">
          Updated {lastUpdate.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
