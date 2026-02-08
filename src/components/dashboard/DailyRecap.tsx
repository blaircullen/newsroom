'use client';

import { useState, useEffect, useCallback } from 'react';
import { HiOutlineSparkles } from 'react-icons/hi2';

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
      <div className="mb-8 relative rounded-2xl overflow-hidden animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 opacity-90" />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-white/20" />
            <div className="h-4 w-40 bg-white/20 rounded-full" />
          </div>
          <div className="space-y-2.5">
            <div className="h-3.5 w-full bg-white/15 rounded-full" />
            <div className="h-3.5 w-5/6 bg-white/15 rounded-full" />
            <div className="h-3.5 w-3/5 bg-white/15 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  const currentRecap = activeType === 'morning' ? recaps?.morning : recaps?.evening;
  if (!currentRecap) return null;

  const hasBothRecaps = recaps?.morning && recaps?.evening;

  return (
    <div className="mb-8 relative rounded-2xl overflow-hidden group">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 dark:from-violet-700 dark:via-indigo-700 dark:to-fuchsia-700" />
      {/* Subtle noise/texture overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15)_0%,_transparent_60%)]" />

      <div className="relative px-6 py-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <HiOutlineSparkles className="w-5 h-5 text-amber-300" />
            <span className="font-display text-base font-bold text-white/90 uppercase tracking-widest">
              The Recap
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              activeType === 'morning'
                ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/30'
                : 'bg-sky-400/20 text-sky-200 ring-1 ring-sky-400/30'
            }`}>
              {activeType === 'morning' ? 'Morning Edition' : 'Evening Edition'}
            </span>
          </div>
          {hasBothRecaps && (
            <button
              onClick={() => setActiveType(prev => prev === 'morning' ? 'evening' : 'morning')}
              className="px-3 py-1 text-[11px] font-semibold text-white/70 bg-white/10 rounded-full hover:bg-white/20 hover:text-white transition-all"
            >
              {activeType === 'morning' ? 'Evening Edition' : 'Morning Edition'}
            </button>
          )}
        </div>

        {/* Recap text */}
        <p className="text-[15px] leading-relaxed text-white/95 font-medium">
          {currentRecap.recap}
        </p>

        {/* Stats footer */}
        {currentRecap.stats && currentRecap.stats.totalPageviews > 0 && (
          <div className="flex items-center gap-4 pt-3 mt-3 border-t border-white/10 text-xs text-white/60">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              {currentRecap.stats.totalPageviews.toLocaleString()} views
            </span>
            {currentRecap.stats.topWriter && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                </svg>
                {currentRecap.stats.topWriter.name} leading
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
