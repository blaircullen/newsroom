'use client';

import Link from 'next/link';
import {
  HiOutlineFire,
  HiOutlineEye,
  HiOutlineArrowTrendingUp,
  HiOutlineLightBulb,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineXMark,
} from 'react-icons/hi2';
import type { Article } from './ArticleCard';

export interface StoryIdea {
  headline: string;
  sourceUrl: string;
  source: string;
  trending?: boolean;
}

interface HotSectionProps {
  hotArticles: Article[];
  storyIdeas: StoryIdea[];
  showAllHot: boolean;
  setShowAllHot: (show: boolean) => void;
  onDismissIdea?: (idea: StoryIdea) => void;
}

export default function HotSection({
  hotArticles,
  storyIdeas,
  showAllHot,
  setShowAllHot,
  onDismissIdea,
}: HotSectionProps) {
  const safeHotArticles = Array.isArray(hotArticles) ? hotArticles : [];
  const safeStoryIdeas = Array.isArray(storyIdeas) ? storyIdeas : [];

  const displayedArticles = showAllHot ? safeHotArticles : safeHotArticles.slice(0, 3);
  const hasMoreArticles = safeHotArticles.length > 3;

  return (
    <div className="pb-6">
      {/* Header - Minimal */}
      <div className="flex items-center justify-between mb-6 md:mb-6">
        <div className="flex items-center gap-2">
          <HiOutlineFire className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-medium text-white md:text-ink-900 md:dark:text-ink-100">Trending</h2>
        </div>
        <span className="text-xs text-white/40 md:text-ink-400">12h</span>
      </div>

      {/* Hot Articles - Clean list */}
      <div>
        {safeHotArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <HiOutlineFire className="w-8 h-8 text-white/20 md:text-ink-300 mb-3" />
            <p className="text-white/50 md:text-ink-500 text-sm">No trending articles</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/5 md:divide-ink-100 md:dark:divide-ink-800">
              {displayedArticles.map((article, index) => (
                <Link key={article.id} href={`/editor/${article.id}`}>
                  <div className="flex items-start gap-4 py-4 active:bg-white/5 md:active:bg-ink-50 md:dark:active:bg-ink-800 transition-colors rounded-lg -mx-2 px-2">
                    {/* Rank */}
                    <span className={`w-5 pt-0.5 text-sm font-medium tabular-nums ${
                      index === 0 ? 'text-orange-500' : 'text-white/30 md:text-ink-400'
                    }`}>
                      {index + 1}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm leading-snug line-clamp-2 mb-1 ${
                        index === 0
                          ? 'text-white md:text-ink-900 md:dark:text-ink-100 font-medium'
                          : 'text-white/70 md:text-ink-700 md:dark:text-ink-300'
                      }`}>
                        {article.headline}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-white/40 md:text-ink-400">
                        {article.author?.name && (
                          <span>{article.author.name}</span>
                        )}
                      </div>
                    </div>

                    {/* Views */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <HiOutlineEye className="w-3.5 h-3.5 text-white/30 md:text-ink-400" />
                      <span className={`text-sm tabular-nums ${
                        index === 0
                          ? 'text-white md:text-ink-900 font-medium'
                          : 'text-white/50 md:text-ink-500'
                      }`}>
                        {(article.recentPageviews ?? article.totalPageviews ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {hasMoreArticles && (
              <button
                onClick={() => setShowAllHot(!showAllHot)}
                className="w-full mt-2 py-3 text-white/50 md:text-ink-500 text-sm font-medium flex items-center justify-center gap-1 active:text-white/70 transition-colors"
              >
                {showAllHot ? 'Show less' : `Show ${safeHotArticles.length - 3} more`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Story Ideas Section - Minimal */}
      {safeStoryIdeas.length > 0 && (
        <div className="mt-10 pt-6 border-t border-white/5 md:border-ink-100 md:dark:border-ink-800">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <HiOutlineLightBulb className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-medium text-white md:text-ink-900 md:dark:text-ink-100">Ideas</h2>
            </div>
            <span className="text-xs text-white/40 md:text-ink-400">From the web</span>
          </div>

          <div className="divide-y divide-white/5 md:divide-ink-100 md:dark:divide-ink-800">
            {safeStoryIdeas.slice(0, 5).map((idea, index) => (
              <div key={index} className="relative py-4 group">
                {/* Dismiss button */}
                {onDismissIdea && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismissIdea(idea);
                    }}
                    className="absolute top-4 right-0 p-1 rounded-full text-white/30 hover:text-white/60 md:text-ink-300 md:hover:text-ink-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Dismiss"
                  >
                    <HiOutlineXMark className="w-4 h-4" />
                  </button>
                )}
                <a
                  href={idea.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block pr-8"
                >
                  <h4 className="text-sm leading-snug line-clamp-2 text-white/80 md:text-ink-700 md:dark:text-ink-300 mb-1.5">
                    {idea.headline}
                  </h4>
                  <div className="flex items-center gap-2">
                    {idea.trending && (
                      <span className="flex items-center gap-1 text-[10px] text-orange-500 font-medium">
                        <HiOutlineArrowTrendingUp className="w-3 h-3" />
                        HOT
                      </span>
                    )}
                    <span className="text-[10px] uppercase tracking-wider text-white/40 md:text-ink-400 font-medium">
                      {idea.source}
                    </span>
                    <HiOutlineArrowTopRightOnSquare className="w-3 h-3 text-white/30 md:text-ink-300" />
                  </div>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
