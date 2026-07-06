'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  HiOutlineEye,
  HiOutlineChartBar,
  HiOutlineFire,
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

export default function AnalyticsSection({ stats, articles, userEmail }: AnalyticsSectionProps) {
  const [revenue, setRevenue] = useState<RevenueData | null>(null);

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

  const publishedArticles = articles.filter(a => a.status === 'PUBLISHED');
  const displayArticles = publishedArticles
    .sort((a, b) => (b.totalPageviews || 0) - (a.totalPageviews || 0))
    .slice(0, 5)
    .map(a => ({ id: a.id, headline: a.headline, views: a.totalPageviews || 0 }));

  return (
    <div className="bg-slate-900 min-h-screen px-4 pt-4 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-xs text-white/50 mt-0.5">Your content performance</p>
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

      {/* Top Performers Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HiOutlineFire className="w-5 h-5 text-orange-500" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Top Performers
            </h2>
          </div>
          <span className="text-xs text-white/40">
            All-time
          </span>
        </div>

        {displayArticles.length > 0 ? (
          <div className="space-y-3">
            {displayArticles.slice(0, 5).map((article, index) => (
              <Link key={article.id} href={`/editor/${article.id}`}>
                <div className="group active:scale-[0.98] transition-transform">
                  <div className="backdrop-blur rounded-2xl p-4 transition-all border bg-white/5 border-white/10 hover:bg-white/10">
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

                      {/* Views */}
                      <div className="flex-shrink-0 text-right">
                        <div className="flex items-center gap-1.5 text-cyan-400">
                          <span className="text-base font-bold tabular-nums">
                            {article.views.toLocaleString()}
                          </span>
                          <HiOutlineEye className="w-4 h-4 opacity-60" />
                        </div>
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
    </div>
  );
}
