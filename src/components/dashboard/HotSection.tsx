'use client';

import Link from 'next/link';
import {
  HiOutlineFire,
  HiOutlineEye,
  HiOutlineArrowTrendingUp,
} from 'react-icons/hi2';
import type { Article } from './ArticleCard';

interface HotSectionProps {
  hotArticles: Article[];
  showAllHot: boolean;
  setShowAllHot: (show: boolean) => void;
}

export default function HotSection({
  hotArticles,
  showAllHot,
  setShowAllHot,
}: HotSectionProps) {
  const safeHotArticles = Array.isArray(hotArticles) ? hotArticles : [];

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
    </div>
  );
}
