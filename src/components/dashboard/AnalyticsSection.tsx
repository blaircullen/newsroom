'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  HiOutlineSparkles,
  HiOutlineEye,
  HiOutlineChartBar,
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

// Rank glow styles
const getRankStyle = (index: number) => {
  if (index === 0) return 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'; // Gold
  if (index === 1) return 'text-zinc-300 drop-shadow-[0_0_8px_rgba(161,161,170,0.5)]'; // Silver
  if (index === 2) return 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]'; // Bronze
  return 'text-white/40';
};

// Animated bar component
function AnimatedBar({ height, delay, isToday }: { height: number; delay: number; isToday: boolean }) {
  const [animatedHeight, setAnimatedHeight] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedHeight(height);
    }, delay);
    return () => clearTimeout(timer);
  }, [height, delay]);

  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      <div className="w-full h-24 flex items-end justify-center">
        <div
          className={`w-full max-w-[20px] rounded-t-md transition-all duration-700 ease-out ${
            isToday
              ? 'bg-gradient-to-t from-cyan-500 to-cyan-400 shadow-[0_0_12px_rgba(0,200,255,0.4)]'
              : 'bg-gradient-to-t from-cyan-600/80 to-cyan-500/80'
          }`}
          style={{ height: `${animatedHeight}%` }}
        />
      </div>
    </div>
  );
}

export default function AnalyticsSection({ stats, articles }: AnalyticsSectionProps) {
  const publishedArticles = articles.filter(a => a.status === 'PUBLISHED');
  const topArticles = publishedArticles
    .sort((a, b) => (b.totalPageviews || 0) - (a.totalPageviews || 0))
    .slice(0, 5);

  // Mock weekly data - in production this would come from an API
  const weeklyData = [
    { day: 'M', views: 45 },
    { day: 'T', views: 72 },
    { day: 'W', views: 58 },
    { day: 'T', views: 89 },
    { day: 'F', views: 65 },
    { day: 'S', views: 40 },
    { day: 'S', views: 31 },
  ];
  const maxViews = Math.max(...weeklyData.map(d => d.views), 1);
  const weekTotal = weeklyData.reduce((sum, d) => sum + d.views, 0);
  const todayIndex = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  const adjustedTodayIndex = todayIndex === 0 ? 6 : todayIndex - 1; // Convert to M-S index

  return (
    <div className="bg-slate-900 min-h-screen px-4 pt-4 pb-32">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-white to-cyan-400 bg-clip-text text-transparent">
          Analytics
        </h1>
        <p className="text-xs text-white/50 mt-1 flex items-center gap-1">
          <HiOutlineSparkles className="w-3 h-3" />
          Stories by the Numbers
        </p>
      </div>

      {/* Hero Metric */}
      <div className="py-8 text-center">
        <div className="relative inline-block">
          <div className="absolute inset-0 blur-2xl bg-cyan-500/20 rounded-full scale-150 animate-pulse" />
          <div className="relative text-7xl font-bold bg-gradient-to-b from-white to-cyan-200 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,200,255,0.3)]">
            {stats.totalViews.toLocaleString()}
          </div>
        </div>
        <p className="text-sm text-white/50 mt-2">total views</p>
      </div>

      {/* Secondary Stats */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur border border-white/10">
          <span className="text-sm font-semibold text-white">{stats.published}</span>
          <span className="text-xs text-white/50">published</span>
        </div>
        <div className="w-px h-4 bg-white/20" />
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur border border-white/10">
          <span className="text-sm font-semibold text-white">{stats.drafts}</span>
          <span className="text-xs text-white/50">drafts</span>
        </div>
        <div className="w-px h-4 bg-white/20" />
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur border border-white/10">
          <span className="text-sm font-semibold text-cyan-400">{stats.total}</span>
          <span className="text-xs text-white/50">total</span>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 mb-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-widest text-white/50 font-medium">This Week</span>
          <div className="text-right">
            <span className="text-lg font-bold text-white">{weekTotal.toLocaleString()}</span>
            <span className="text-xs text-white/50 ml-1">views</span>
          </div>
        </div>

        {/* Grid lines */}
        <div className="relative">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div className="border-t border-white/5" />
            <div className="border-t border-white/5" />
            <div className="border-t border-white/5" />
            <div className="border-t border-white/5" />
          </div>

          {/* Bars */}
          <div className="flex items-end gap-2">
            {weeklyData.map((data, index) => (
              <AnimatedBar
                key={data.day + index}
                height={(data.views / maxViews) * 100}
                delay={index * 50}
                isToday={index === adjustedTodayIndex}
              />
            ))}
          </div>
        </div>

        {/* Day labels */}
        <div className="flex items-center gap-2 mt-2">
          {weeklyData.map((data, index) => (
            <div key={data.day + index} className="flex-1 text-center">
              <span className={`text-[10px] ${index === adjustedTodayIndex ? 'text-cyan-400 font-semibold' : 'text-white/40'}`}>
                {data.day}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Performers */}
      {topArticles.length > 0 ? (
        <div>
          <h2 className="text-xs uppercase tracking-widest text-white/50 font-medium mb-4">
            Top Performers
          </h2>
          <div className="space-y-3">
            {topArticles.map((article, index) => (
              <Link key={article.id} href={`/editor/${article.id}`}>
                <div className="group active:scale-[0.98] transition-transform">
                  <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Rank */}
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                        <span className={`text-xl font-bold ${getRankStyle(index)}`}>
                          {index + 1}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-white leading-snug line-clamp-2 mb-1">
                          {article.headline}
                        </h3>
                        <p className="text-xs text-white/50">
                          by {article.author?.name || 'Unknown'}
                        </p>
                      </div>

                      {/* Views */}
                      <div className="flex-shrink-0 text-right">
                        <div className="flex items-center gap-1 text-cyan-400">
                          <HiOutlineEye className="w-4 h-4" />
                          <span className="text-sm font-semibold">
                            {(article.totalPageviews || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="pt-12 text-center">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 blur-xl bg-cyan-500/10 rounded-full scale-150" />
            <div className="relative w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <HiOutlineChartBar className="w-8 h-8 text-cyan-500/50" />
            </div>
          </div>
          <p className="text-white font-medium">No analytics yet</p>
          <p className="text-sm text-white/50 mt-1">Publish your first story to see performance data</p>
        </div>
      )}
    </div>
  );
}
