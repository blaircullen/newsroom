'use client';

import Link from 'next/link';
import { Article } from './ArticleCard';
import { HiOutlineFire } from 'react-icons/hi2';

interface TrendingPanelProps {
  articles: Article[];
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export default function TrendingPanel({ articles }: TrendingPanelProps) {
  if (articles.length === 0) return null;

  const maxViews = Math.max(...articles.map(a => a.totalPageviews || 0), 1);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="terminal-label text-paper-400">Trending</h2>
        <HiOutlineFire className="w-4 h-4 text-press-400" />
      </div>

      <div className="space-y-3">
        {articles.slice(0, 5).map((article, i) => {
          const views = article.totalPageviews || 0;
          const barWidth = maxViews > 0 ? (views / maxViews) * 100 : 0;

          return (
            <Link
              key={article.id}
              href={`/editor/${article.id}`}
              className="block group"
            >
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs text-paper-500 w-4 text-right shrink-0 mt-0.5">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-paper-200 font-medium truncate group-hover:text-paper-100 transition-colors">
                    {article.headline || 'Untitled'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-paper-400">{formatNumber(views)} views</span>
                    <span className="text-xs text-paper-600">·</span>
                    <span className="text-xs text-paper-500">{article.author?.name}</span>
                  </div>
                  {/* Bar chart */}
                  <div className="mt-1.5 h-1.5 bg-ink-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-press-700 to-press-500 rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
