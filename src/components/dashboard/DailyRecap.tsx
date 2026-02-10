'use client';

import { useState, useEffect, useCallback } from 'react';

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
  type: 'morning' | 'evening';
  recap: string;
  stats: RecapStats;
  date: string;
  createdAt: string;
}

interface RecapsResponse {
  recap: RecapData | null;
}

export default function DailyRecap() {
  const [recapData, setRecapData] = useState<RecapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecaps = useCallback(async () => {
    try {
      const res = await fetch('/api/recaps/latest');
      if (!res.ok) return;
      const data: RecapsResponse = await res.json();
      setRecapData(data.recap);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecaps();
    const interval = setInterval(fetchRecaps, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchRecaps]);

  if (!isLoading && !recapData) {
    return null;
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="mb-8 relative rounded-2xl overflow-hidden animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#111d35] to-[#0a1628]" />
        <div className="absolute top-0 left-0 right-0 h-1 bg-red-800/40" />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-5 bg-white/10 rounded" />
            <div className="h-4 w-40 bg-white/10 rounded-full" />
          </div>
          <div className="space-y-2.5">
            <div className="h-3.5 w-full bg-white/8 rounded-full" />
            <div className="h-3.5 w-5/6 bg-white/8 rounded-full" />
            <div className="h-3.5 w-3/5 bg-white/8 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!recapData) return null;

  const isMorning = recapData.type === 'morning';

  return (
    <div className="mb-8 relative rounded-2xl overflow-hidden group">
      {/* Deep navy patriotic base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#111d35] to-[#0d1a2d]" />

      {/* Scattered stars pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(1.2px 1.2px at 8% 15%, rgba(255,255,255,0.18), transparent),
            radial-gradient(1px 1px at 22% 55%, rgba(255,255,255,0.12), transparent),
            radial-gradient(1.4px 1.4px at 38% 25%, rgba(255,255,255,0.15), transparent),
            radial-gradient(1px 1px at 52% 70%, rgba(255,255,255,0.10), transparent),
            radial-gradient(1.3px 1.3px at 68% 12%, rgba(255,255,255,0.14), transparent),
            radial-gradient(1px 1px at 82% 45%, rgba(255,255,255,0.09), transparent),
            radial-gradient(1.2px 1.2px at 15% 80%, rgba(255,255,255,0.11), transparent),
            radial-gradient(1px 1px at 45% 90%, rgba(255,255,255,0.08), transparent),
            radial-gradient(1.3px 1.3px at 72% 78%, rgba(255,255,255,0.12), transparent),
            radial-gradient(1px 1px at 92% 25%, rgba(255,255,255,0.10), transparent),
            radial-gradient(1.5px 1.5px at 5% 45%, rgba(255,255,255,0.16), transparent),
            radial-gradient(1px 1px at 58% 40%, rgba(255,255,255,0.08), transparent)
          `,
        }}
      />

      {/* Subtle diagonal pinstripes */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 30px, white 30px, white 31px)',
        }}
      />

      {/* Red accent stripe - top */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-700 via-red-500 to-red-700" />

      {/* Subtle red glow */}
      <div className="absolute -top-8 right-16 w-40 h-40 bg-red-600/[0.06] rounded-full blur-3xl" />
      <div className="absolute -bottom-8 left-16 w-32 h-32 bg-blue-400/[0.04] rounded-full blur-3xl" />

      <div className="relative px-6 py-5">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-3">
          {/* Red star */}
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 0l2.5 6.9H20l-6 4.6 2.3 7L10 13.8l-6.3 4.7 2.3-7-6-4.6h7.5z"/>
          </svg>
          <span className="font-display text-base font-bold text-white uppercase tracking-[0.2em]">
            The Recap
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            isMorning
              ? 'bg-red-500/15 text-red-300 ring-1 ring-red-500/25'
              : 'bg-blue-400/15 text-blue-300 ring-1 ring-blue-400/25'
          }`}>
            {isMorning ? 'Morning Briefing' : 'Evening Briefing'}
          </span>
        </div>

        {/* Recap text */}
        <p className="text-[15px] leading-relaxed text-white/85 font-medium">
          {recapData.recap}
        </p>

        {/* Stats footer */}
        {recapData.stats && recapData.stats.totalPageviews > 0 && (
          <div className="flex items-center gap-4 pt-3 mt-3 border-t border-white/[0.06] text-xs text-white/40">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-red-400/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <span className="text-white/60 font-medium">{recapData.stats.totalPageviews.toLocaleString()}</span> views
            </span>
            {recapData.stats.topWriter && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-red-400/60" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 0l2.5 6.9H20l-6 4.6 2.3 7L10 13.8l-6.3 4.7 2.3-7-6-4.6h7.5z"/>
                </svg>
                <span className="text-white/60 font-medium">{recapData.stats.topWriter.name}</span> leading
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
