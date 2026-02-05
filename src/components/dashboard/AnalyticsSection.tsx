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

interface AnalyticsSectionProps {
  stats: {
    total: number;
    published: number;
    drafts: number;
    totalViews: number;
  };
  articles: Article[];
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

export default function AnalyticsSection({ stats, articles }: AnalyticsSectionProps) {
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchRealtime = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/realtime');
      if (res.ok) {
        const data = await res.json();
        setRealtime(data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch realtime data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRealtime();
    // Refresh every 10 seconds
    const interval = setInterval(fetchRealtime, 10000);
    return () => clearInterval(interval);
  }, [fetchRealtime]);

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
          {isLoading ? (
            <div className="py-8">
              <div className="w-8 h-8 border-2 border-white/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-6xl font-bold text-white tabular-nums">
                  {realtime?.activeVisitors || 0}
                </span>
              </div>
              <p className="text-white/60 text-sm">
                active across all sites
              </p>
            </>
          )}
        </div>
      </div>


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

        {displayArticles.length > 0 ? (
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
                            {article.trend === 'up' && (
                              <>
                                <HiArrowTrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[10px] text-emerald-400 font-medium">+{article.trendValue}</span>
                              </>
                            )}
                            {article.trend === 'down' && (
                              <>
                                <HiArrowTrendingDown className="w-3.5 h-3.5 text-red-400" />
                                <span className="text-[10px] text-red-400 font-medium">-{article.trendValue}</span>
                              </>
                            )}
                            {article.trend === 'same' && (
                              <HiMinus className="w-3.5 h-3.5 text-white/30" />
                            )}
                            {article.trend === 'new' && (
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
