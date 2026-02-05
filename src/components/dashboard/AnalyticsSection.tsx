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
    <div className="bg-black min-h-screen px-5 pt-6 pb-32">
      {/* Minimal Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-medium text-white tracking-tight">Analytics</h1>
        {isLive && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-emerald-400">Live</span>
          </div>
        )}
      </div>

      {/* Live Readers Hero - Clean, minimal */}
      <div className="mb-10">
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className={`text-7xl font-light text-white tabular-nums tracking-tight transition-opacity ${isLoading && !realtime ? 'opacity-30' : ''}`}>
              {realtime?.activeVisitors ?? '—'}
            </span>
          </div>
          <p className="text-white/40 text-sm font-light">
            readers active now
          </p>
        </div>
      </div>


      {/* Hot Right Now Section - Minimal list */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-medium text-white/70">
            {realtime?.recentViews?.length ? 'Trending Now' : 'Top Stories'}
          </h2>
          <span className="text-xs text-white/30">
            {realtime?.recentViews?.length ? '30 min' : 'All time'}
          </span>
        </div>

        {isLoading && !realtime ? (
          // Skeleton loading state - minimal
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 py-4 animate-pulse">
                <div className="w-6 h-6 rounded-full bg-white/5" />
                <div className="flex-1">
                  <div className="h-4 bg-white/5 rounded w-3/4" />
                </div>
                <div className="w-10 h-4 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : displayArticles.length > 0 ? (
          <div className="divide-y divide-white/5">
            {displayArticles.slice(0, 5).map((article, index) => (
              <Link key={article.id} href={`/editor/${article.id}`}>
                <div className="flex items-center gap-4 py-4 active:bg-white/5 transition-colors rounded-lg -mx-2 px-2">
                  {/* Rank - minimal */}
                  <span className={`w-6 text-center font-medium tabular-nums ${
                    index === 0 ? 'text-white' : 'text-white/30'
                  }`}>
                    {index + 1}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm leading-snug line-clamp-2 ${
                      index === 0 ? 'text-white font-medium' : 'text-white/70'
                    }`}>
                      {article.headline}
                    </h3>
                  </div>

                  {/* Views and Trend */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Trend indicator */}
                    {realtime?.recentViews?.length && 'trend' in article && (
                      <>
                        {(article as RealtimeData['recentViews'][0]).trend === 'up' && (
                          <HiArrowTrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        {(article as RealtimeData['recentViews'][0]).trend === 'down' && (
                          <HiArrowTrendingDown className="w-3.5 h-3.5 text-red-400" />
                        )}
                        {(article as RealtimeData['recentViews'][0]).trend === 'new' && (
                          <span className="text-[10px] text-amber-400 font-medium">NEW</span>
                        )}
                      </>
                    )}
                    <span className={`text-sm tabular-nums ${
                      index === 0 ? 'text-white font-medium' : 'text-white/50'
                    }`}>
                      {article.views.toLocaleString()}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <HiOutlineChartBar className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 text-sm">No data yet</p>
          </div>
        )}
      </div>

      {/* Last updated - subtle */}
      {lastUpdate && (
        <p className="text-center text-xs text-white/20 mt-8">
          {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}
