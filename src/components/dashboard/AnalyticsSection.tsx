'use client';

import Link from 'next/link';
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

// Rank border colors
const getRankStyle = (index: number) => {
  if (index === 0) return 'border-[#B8860B] bg-[#B8860B]/10'; // Gold
  if (index === 1) return 'border-[#71717A] bg-[#71717A]/10'; // Silver
  if (index === 2) return 'border-[#A16207] bg-[#A16207]/10'; // Bronze
  return 'border-[#6B6B6B]/40 bg-transparent';
};

export default function AnalyticsSection({ stats, articles }: AnalyticsSectionProps) {
  const publishedArticles = articles.filter(a => a.status === 'PUBLISHED');
  const topArticles = publishedArticles
    .sort((a, b) => (b.totalPageviews || 0) - (a.totalPageviews || 0))
    .slice(0, 5);

  // Get current date for dateline
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="bg-[#FAFAF8] min-h-screen -mx-4 px-4 -mt-4 pt-4 md:bg-transparent md:min-h-0 md:mx-0 md:px-0 md:mt-0 md:pt-0">
      {/* Header - Mobile editorial style */}
      <div className="md:hidden">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Analytics</h1>
        <p className="text-[11px] text-[#6B6B6B] uppercase tracking-widest mt-1">{today}</p>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block mb-6">
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100">Analytics Overview</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Performance metrics for your content</p>
      </div>

      {/* Mobile Hero Stat */}
      <div className="pt-6 mb-6 md:hidden">
        <div className="text-[56px] font-bold text-[#1A1A1A] leading-none tracking-tight">
          {stats.totalViews.toLocaleString()}
        </div>
        <div className="text-sm text-[#6B6B6B] mt-1">views today</div>
      </div>

      {/* Mobile Secondary Stats Row */}
      <div className="flex items-center gap-4 pb-6 border-b border-[#E5E5E5] md:hidden">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-[#1A1A1A]">{stats.total}</span>
          <span className="text-xs text-[#6B6B6B] uppercase tracking-wide">total</span>
        </div>
        <div className="w-px h-4 bg-[#E5E5E5]" />
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-[#1D7D4D]">{stats.published}</span>
          <span className="text-xs text-[#6B6B6B] uppercase tracking-wide">published</span>
        </div>
        <div className="w-px h-4 bg-[#E5E5E5]" />
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-[#1A1A1A]">{stats.drafts}</span>
          <span className="text-xs text-[#6B6B6B] uppercase tracking-wide">drafts</span>
        </div>
      </div>

      {/* Top Performers Section */}
      {topArticles.length > 0 ? (
        <div className="pt-6 md:pt-0">
          <h2 className="text-[11px] text-[#6B6B6B] md:text-sm md:text-ink-500 md:dark:text-ink-400 uppercase tracking-widest font-medium mb-4">
            Top Performers
          </h2>
          <div className="space-y-4">
            {topArticles.map((article, index) => (
              <Link key={article.id} href={`/editor/${article.id}`}>
                <div className="group active:bg-[#F0F0F0] md:active:bg-ink-50 md:dark:active:bg-ink-800 rounded-lg -mx-2 px-2 py-3 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Rank Badge */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 ${getRankStyle(index)}`}>
                      <span className="text-lg font-bold text-[#1A1A1A] md:text-ink-900 md:dark:text-ink-100">{index + 1}</span>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-[#1A1A1A] md:text-ink-900 md:dark:text-ink-100 leading-snug line-clamp-2">
                        {article.headline}
                      </h3>
                      <p className="text-xs text-[#6B6B6B] md:text-ink-500 mt-1">
                        by {article.author?.name || 'Unknown'} · {(article.totalPageviews || 0).toLocaleString()} views
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="pt-12 text-center">
          <div className="text-[#6B6B6B] md:text-ink-400 text-4xl mb-3">📰</div>
          <p className="text-[#1A1A1A] md:text-ink-700 md:dark:text-ink-200 font-medium">No published stories yet.</p>
          <p className="text-sm text-[#6B6B6B] md:text-ink-500 mt-1">Your top performers will appear here.</p>
        </div>
      )}
    </div>
  );
}
