'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  HiOutlineSparkles,
  HiOutlineArrowTrendingUp,
  HiOutlineArrowTrendingDown,
  HiOutlineEye,
  HiOutlineDocumentText,
  HiOutlinePencilSquare,
} from 'react-icons/hi2';

interface TopArticle {
  id: string;
  headline: string;
  pageviews: number;
  authorName: string;
}

interface RecapStats {
  totalArticles: number;
  articlesBySite: Record<string, number>;
  totalPageviews: number;
  topArticles: TopArticle[];
  topWriter: { name: string; pageviews: number } | null;
  previousPeriodPageviews: number;
}

interface RecapData {
  recap: string;
  stats: RecapStats;
  date: string;
  createdAt: string;
}

interface RecapsResponse {
  morning: RecapData | null;
  evening: RecapData | null;
}

export default function DailyRecap() {
  const [recaps, setRecaps] = useState<RecapsResponse | null>(null);
  const [activeType, setActiveType] = useState<'morning' | 'evening'>('morning');
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecaps = useCallback(async () => {
    try {
      const res = await fetch('/api/recaps/latest');
      if (!res.ok) return;
      const data: RecapsResponse = await res.json();
      setRecaps(data);

      // Default to the most recent recap
      if (data.evening) {
        setActiveType('evening');
      } else if (data.morning) {
        setActiveType('morning');
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecaps();
    // Poll every 5 minutes
    const interval = setInterval(fetchRecaps, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchRecaps]);

  // Don't render anything if no recaps exist
  if (!isLoading && (!recaps || (!recaps.morning && !recaps.evening))) {
    return null;
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="mb-8 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 rounded-xl border border-violet-200 dark:border-violet-800 overflow-hidden animate-pulse">
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-200 dark:bg-violet-700" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-violet-200 dark:bg-violet-700 rounded" />
            <div className="h-3 w-48 bg-violet-100 dark:bg-violet-800 rounded mt-1.5" />
          </div>
        </div>
        <div className="px-5 pb-5 space-y-2">
          <div className="h-3 w-full bg-violet-100 dark:bg-violet-800 rounded" />
          <div className="h-3 w-5/6 bg-violet-100 dark:bg-violet-800 rounded" />
          <div className="h-3 w-4/6 bg-violet-100 dark:bg-violet-800 rounded" />
        </div>
      </div>
    );
  }

  const currentRecap = activeType === 'morning' ? recaps?.morning : recaps?.evening;
  if (!currentRecap) return null;

  const stats = currentRecap.stats;
  const changePercent = stats.previousPeriodPageviews > 0
    ? Math.round(((stats.totalPageviews - stats.previousPeriodPageviews) / stats.previousPeriodPageviews) * 100)
    : null;
  const isUp = changePercent !== null && changePercent >= 0;
  const hasBothRecaps = recaps?.morning && recaps?.evening;

  return (
    <div className="mb-8 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 rounded-xl border border-violet-200 dark:border-violet-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-800 flex items-center justify-center">
          <HiOutlineSparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-ink-900 dark:text-ink-100">
              Newsroom Recap
            </h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              activeType === 'morning'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400'
            }`}>
              {activeType === 'morning' ? 'Morning' : 'Evening'}
            </span>
          </div>
          <p className="text-xs text-ink-500 dark:text-ink-400">
            {activeType === 'morning' ? "Yesterday's" : "Today's"} performance at a glance
          </p>
        </div>
        {/* Toggle if both recaps exist */}
        {hasBothRecaps && (
          <button
            onClick={() => setActiveType(prev => prev === 'morning' ? 'evening' : 'morning')}
            className="px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-800/50 rounded-lg hover:bg-violet-200 dark:hover:bg-violet-700/50 transition-colors"
          >
            {activeType === 'morning' ? 'Evening' : 'Morning'}
          </button>
        )}
      </div>

      {/* Recap text */}
      <div className="px-5 pb-4">
        <p className="text-sm text-ink-700 dark:text-ink-300 leading-relaxed">
          {currentRecap.recap}
        </p>
      </div>

      {/* Stats bar */}
      <div className="px-5 pb-4 flex items-center gap-6 text-xs">
        <div className="flex items-center gap-1.5 text-ink-600 dark:text-ink-400">
          <HiOutlineEye className="w-4 h-4" />
          <span className="font-semibold">{stats.totalPageviews.toLocaleString()}</span>
          <span>views</span>
          {changePercent !== null && (
            <span className={`flex items-center gap-0.5 font-semibold ${
              isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
            }`}>
              {isUp ? <HiOutlineArrowTrendingUp className="w-3.5 h-3.5" /> : <HiOutlineArrowTrendingDown className="w-3.5 h-3.5" />}
              {Math.abs(changePercent)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-ink-600 dark:text-ink-400">
          <HiOutlineDocumentText className="w-4 h-4" />
          <span className="font-semibold">{stats.totalArticles}</span>
          <span>published</span>
        </div>
        {stats.topWriter && (
          <div className="flex items-center gap-1.5 text-ink-600 dark:text-ink-400">
            <HiOutlinePencilSquare className="w-4 h-4" />
            <span className="font-semibold">{stats.topWriter.name}</span>
          </div>
        )}
      </div>

      {/* Top articles */}
      {stats.topArticles.length > 0 && (
        <div className="px-5 pb-5 border-t border-violet-200/50 dark:border-violet-700/30 pt-3">
          <div className="space-y-1.5">
            {stats.topArticles.slice(0, 3).map((article, index) => (
              <Link
                key={article.id}
                href={`/editor/${article.id}`}
                className="flex items-center gap-2.5 group"
              >
                <span className="w-5 h-5 rounded-full bg-violet-200 dark:bg-violet-700 text-violet-700 dark:text-violet-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </span>
                <span className="text-xs text-ink-700 dark:text-ink-300 truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors flex-1">
                  {article.headline}
                </span>
                <span className="text-[10px] font-semibold text-ink-400 dark:text-ink-500 flex-shrink-0">
                  {article.pageviews.toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
