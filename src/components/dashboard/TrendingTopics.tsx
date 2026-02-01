'use client';

import { useState, useEffect } from 'react';
import { HiOutlineArrowTrendingUp, HiOutlineArrowTopRightOnSquare } from 'react-icons/hi2';

interface TrendingTopic {
  rank: number;
  name: string;
  url: string;
  tweet_volume: number | null;
  category?: string;
}

interface TrendingData {
  updated_at: string | null;
  location: string;
  trends: TrendingTopic[];
}

function formatVolume(volume: number | null): string {
  if (!volume) return '';
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M posts`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K posts`;
  return `${volume} posts`;
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function TrendingTopics() {
  const [data, setData] = useState<TrendingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await fetch('/api/trending');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json);
      } catch {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrending();

    // Refresh every 5 minutes
    const interval = setInterval(fetchTrending, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-ink-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-ink-100 animate-pulse" />
          <div className="h-4 w-32 rounded bg-ink-100 animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-ink-50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || data.trends.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-ink-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <HiOutlineArrowTrendingUp className="w-5 h-5 text-press-500" />
          <h3 className="font-display font-semibold text-ink-900 text-sm">
            Trending on 𝕏
          </h3>
        </div>
        <p className="text-ink-400 text-xs">
          Trending topics will appear here once the feed is connected.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-ink-100 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HiOutlineArrowTrendingUp className="w-5 h-5 text-press-500" />
          <h3 className="font-display font-semibold text-ink-900 text-sm">
            Trending on 𝕏
          </h3>
        </div>
        {data.updated_at && (
          <span className="text-[11px] text-ink-400">
            {timeAgo(data.updated_at)}
          </span>
        )}
      </div>

      {/* Trending List */}
      <div className="space-y-1">
        {data.trends.map((trend) => (
          <a
            key={trend.rank}
            href={trend.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 -mx-1 rounded-lg hover:bg-ink-50 transition-colors group"
          >
            {/* Rank */}
            <span className="text-xs font-mono font-medium text-ink-300 w-4 text-right flex-shrink-0">
              {trend.rank}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-900 group-hover:text-press-600 transition-colors truncate">
                {trend.name}
              </p>
              {trend.tweet_volume && (
                <p className="text-[11px] text-ink-400 mt-0.5">
                  {formatVolume(trend.tweet_volume)}
                </p>
              )}
            </div>

            {/* External link icon */}
            <HiOutlineArrowTopRightOnSquare className="w-3.5 h-3.5 text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </a>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-ink-100">
        <a
          href="https://x.com/explore/tabs/trending"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-press-500 hover:text-press-600 font-medium transition-colors"
        >
          See all trends →
        </a>
      </div>
    </div>
  );
}
