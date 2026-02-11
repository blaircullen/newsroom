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

export interface StoryIdeaSource {
  name: string;
  url: string;
}

export interface StoryIdea {
  headline: string;
  sourceUrl: string;
  source: string;
  trending?: boolean;
  sources?: StoryIdeaSource[];
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
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 md:mb-4">
        <HiOutlineFire className="w-5 h-5 md:w-6 md:h-6 text-orange-400 animate-pulse" />
        <h2 className="text-lg md:text-xl font-bold text-white md:text-ink-900 md:dark:text-ink-100">Hot Today</h2>
      </div>
      <p className="text-xs md:text-sm text-white/70 md:text-ink-500 mb-4">Most read posts in the last 12 hours</p>

      {/* Hot Articles */}
      <div className="space-y-3">
        {safeHotArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <HiOutlineFire className="w-12 h-12 text-white/30 md:text-ink-300 mb-3" />
            <p className="text-white/80 md:text-ink-700">No hot articles today</p>
            <p className="text-white/50 md:text-ink-400 text-sm mt-1">Check back soon</p>
          </div>
        ) : (
          <>
            {displayedArticles.map((article, index) => (
              <Link key={article.id} href={`/editor/${article.id}`}>
                <div className="group active:scale-[0.98] transition-transform">
                  <div className="relative overflow-hidden rounded-2xl bg-slate-800/80 md:bg-white md:dark:bg-ink-900 border border-orange-500/40 md:border-orange-200 md:dark:border-orange-800">
                    <div className="p-4">
                      <div className="absolute top-3 right-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/40">
                          <span className="text-white text-sm font-bold">{index + 1}</span>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-white md:text-ink-900 md:dark:text-ink-100 line-clamp-2 leading-snug mb-2 pr-10">
                        {article.headline}
                      </h3>

                      {article.author?.name && (
                        <p className="text-xs text-white/50 md:text-ink-500 mb-2">
                          by <span className="text-white/70 md:text-ink-700 font-medium">{article.author.name}</span>
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-orange-300 md:text-orange-600 font-semibold">
                          <HiOutlineEye className="w-4 h-4" />
                          <span>{(article.recentPageviews ?? article.totalPageviews ?? 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1 text-white/60 md:text-ink-400">
                          <HiOutlineArrowTrendingUp className="w-4 h-4" />
                          <span>{(article.recentUniqueVisitors ?? article.totalUniqueVisitors ?? 0)} unique</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {hasMoreArticles && (
              <button
                onClick={() => setShowAllHot(!showAllHot)}
                className="w-full py-3 rounded-xl bg-slate-800/50 md:bg-ink-50 md:dark:bg-ink-800 border border-slate-700/50 md:border-ink-200 md:dark:border-ink-700 text-white/70 md:text-ink-600 md:dark:text-ink-300 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                {showAllHot ? (
                  <>Show Less</>
                ) : (
                  <>
                    <span>Show {safeHotArticles.length - 3} More</span>
                    <span className="text-orange-400 md:text-orange-600">#{4}-{safeHotArticles.length}</span>
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Story Ideas Section */}
      {safeStoryIdeas.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <HiOutlineLightBulb className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-bold text-white md:text-ink-900 md:dark:text-ink-100">Story Ideas</h2>
          </div>
          <p className="text-xs text-white/50 md:text-ink-400 mb-3">Trending topics from around the web</p>
          <div className="space-y-2">
            {safeStoryIdeas.slice(0, 5).map((idea, index) => (
              <div key={index} className="group active:scale-[0.98] transition-transform">
                <div className={`p-3 rounded-xl relative overflow-hidden ${
                  idea.trending
                    ? 'bg-gradient-to-r from-red-900/40 to-orange-900/40 md:from-red-50 md:to-orange-50 md:dark:from-red-900/20 md:dark:to-orange-900/20 border border-red-500/50 md:border-red-300 md:dark:border-red-700 ring-1 ring-red-400/20'
                    : 'bg-slate-800/60 md:bg-white md:dark:bg-ink-900 border border-yellow-500/20 md:border-amber-200 md:dark:border-amber-800/50 group-active:border-yellow-500/40'
                }`}>
                  {idea.trending && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-bl-lg">
                        Multi-Source
                      </div>
                    </div>
                  )}
                  {/* Dismiss button */}
                  {onDismissIdea && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissIdea(idea);
                      }}
                      className={`absolute top-2 right-2 p-1 rounded-full transition-colors z-10 ${
                        idea.trending
                          ? 'top-7 text-red-300/60 hover:text-red-200 hover:bg-red-500/20 md:text-red-400 md:hover:text-red-600 md:hover:bg-red-100'
                          : 'text-white/40 hover:text-white/80 hover:bg-white/10 md:text-ink-400 md:hover:text-ink-600 md:hover:bg-ink-100'
                      }`}
                      title="Dismiss suggestion"
                    >
                      <HiOutlineXMark className="w-4 h-4" />
                    </button>
                  )}
                  <a
                    href={idea.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0 pr-6">
                        <h4 className={`text-sm font-medium line-clamp-2 leading-snug ${
                          idea.trending ? 'text-white md:text-red-900 md:dark:text-red-100 pr-10' : 'text-white/90 md:text-ink-800 md:dark:text-ink-200'
                        }`}>
                          {idea.headline}
                        </h4>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {idea.trending && (
                            <span className="flex items-center gap-1 text-[10px] text-orange-300 md:text-red-600 font-semibold">
                              <HiOutlineArrowTrendingUp className="w-3 h-3" />
                              HOT
                            </span>
                          )}
                          {idea.trending && idea.sources && idea.sources.length > 1 ? (
                            idea.sources.map((src, i) => (
                              <a
                                key={i}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] uppercase tracking-wider font-medium text-orange-300/80 md:text-red-600/80 hover:text-orange-200 md:hover:text-red-700 underline underline-offset-2 decoration-orange-300/30 md:decoration-red-300/50"
                              >
                                {src.name}
                              </a>
                            ))
                          ) : (
                            <>
                              <span className={`text-[10px] uppercase tracking-wider font-medium ${
                                idea.trending ? 'text-orange-300/80 md:text-red-600/80' : 'text-yellow-400/80 md:text-amber-600'
                              }`}>
                                {idea.source}
                              </span>
                              <HiOutlineArrowTopRightOnSquare className="w-3 h-3 text-white/40 md:text-ink-400" />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
