'use client';

import { useState, useEffect } from 'react';
import { HiOutlineTrophy, HiOutlineChartBar } from 'react-icons/hi2';

interface LeaderboardEntry {
  id: string;
  name: string;
  rank: number;
  articleCount: number;
  totalPageviews: number;
  avgPageviewsPerArticle: number;
  rankChange?: number | null;
  isNew?: boolean;
}

export default function WriterLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/analytics/leaderboard?period=${period}`);
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
    // Refresh every 5 minutes
    const interval = setInterval(fetchLeaderboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [period]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-ink-100 dark:bg-ink-800 rounded animate-pulse" />
          <div className="h-4 w-32 bg-ink-100 dark:bg-ink-800 rounded animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-ink-50 dark:bg-ink-800 rounded-lg mb-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (leaderboard.length === 0) return null;

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-lg shadow-amber-200 dark:shadow-amber-900/50';
      case 2:
        return 'bg-gradient-to-br from-slate-300 to-slate-400 text-white';
      case 3:
        return 'bg-gradient-to-br from-amber-600 to-amber-700 text-white';
      default:
        return 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300';
    }
  };

  return (
    <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-ink-100 dark:border-ink-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HiOutlineTrophy className="w-5 h-5 text-amber-500" />
            <h3 className="font-display font-semibold text-ink-900 dark:text-white text-sm">
              Top Writers
            </h3>
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-ink-800 rounded-lg p-0.5">
            <button
              onClick={() => setPeriod('week')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                period === 'week'
                  ? 'bg-ink-900 dark:bg-ink-700 text-white'
                  : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-300'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                period === 'month'
                  ? 'bg-ink-900 dark:bg-ink-700 text-white'
                  : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-300'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="p-2">
        {leaderboard.slice(0, 5).map((entry) => (
          <div
            key={entry.id}
            className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
              entry.rank === 1
                ? 'bg-amber-50 dark:bg-amber-900/20'
                : 'hover:bg-ink-50 dark:hover:bg-ink-800'
            }`}
          >
            {/* Rank badge */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${getRankStyle(
                entry.rank
              )}`}
            >
              {entry.rank}
            </div>

            {/* Writer info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-sm text-ink-900 dark:text-white truncate">
                  {entry.name}
                </p>
                {entry.isNew && (
                  <span className="text-[8px] font-bold text-press-500 bg-press-50 dark:bg-press-900/30 px-1 rounded">
                    NEW
                  </span>
                )}
                {entry.rankChange != null && entry.rankChange > 0 && (
                  <svg className="w-3 h-3 text-emerald-500" viewBox="0 0 8 8">
                    <path d="M4 1L7 5H1L4 1Z" fill="currentColor" />
                  </svg>
                )}
                {entry.rankChange != null && entry.rankChange < 0 && (
                  <svg className="w-3 h-3 text-red-400" viewBox="0 0 8 8">
                    <path d="M4 7L7 3H1L4 7Z" fill="currentColor" />
                  </svg>
                )}
              </div>
              <p className="text-xs text-ink-400">
                {entry.articleCount} article{entry.articleCount !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Stats */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-ink-900 dark:text-white">
                {entry.totalPageviews.toLocaleString()}
              </p>
              <p className="text-[10px] text-ink-400">pageviews</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
