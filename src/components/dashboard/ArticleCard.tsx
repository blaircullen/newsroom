'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  HiOutlineEye,
  HiOutlineChartBarSquare,
  HiOutlineClock,
  HiOutlineTrash,
} from 'react-icons/hi2';

export interface Article {
  id: string;
  headline: string;
  subHeadline?: string;
  status: string;
  featuredImage?: string;
  publishedUrl?: string;
  totalPageviews: number;
  totalUniqueVisitors: number;
  recentPageviews?: number;
  recentUniqueVisitors?: number;
  analyticsUpdatedAt?: string;
  updatedAt: string;
  publishedAt?: string;
  createdAt?: string;
  author: { name: string };
  tags?: { tag: { name: string } }[];
}

interface ArticleCardProps {
  article: Article;
  isAdmin?: boolean;
  onDelete?: (id: string, headline: string) => void;
  isTopPerformer?: boolean;
  isUpdating?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; class: string; mobileClass: string }> = {
  DRAFT: {
    label: 'Draft',
    class: 'status-draft',
    mobileClass: 'from-ink-500/25 to-ink-600/15 border-ink-400/40 text-ink-200',
  },
  SUBMITTED: {
    label: 'Submitted',
    class: 'status-submitted',
    mobileClass: 'from-blue-500/25 to-blue-600/15 border-blue-400/40 text-blue-300',
  },
  IN_REVIEW: {
    label: 'In Review',
    class: 'status-in-review',
    mobileClass: 'from-blue-500/25 to-blue-600/15 border-blue-400/40 text-blue-300',
  },
  REVISION_REQUESTED: {
    label: 'Needs Revision',
    class: 'status-revision-requested',
    mobileClass: 'from-amber-500/25 to-amber-600/15 border-amber-400/40 text-amber-300',
  },
  APPROVED: {
    label: 'Approved',
    class: 'status-approved',
    mobileClass: 'from-violet-500/25 to-violet-600/15 border-violet-400/40 text-violet-300',
  },
  PUBLISHED: {
    label: 'Published',
    class: 'status-published',
    mobileClass: 'from-emerald-500/25 to-emerald-600/15 border-emerald-400/40 text-emerald-300',
  },
  REJECTED: {
    label: 'Rejected',
    class: 'status-rejected',
    mobileClass: 'from-red-500/25 to-red-600/15 border-red-400/40 text-red-300',
  },
};

const STATUS_DOT: Record<string, string> = {
  DRAFT: 'bg-ink-300',
  SUBMITTED: 'bg-blue-400 animate-pulse',
  IN_REVIEW: 'bg-blue-400 animate-pulse',
  REVISION_REQUESTED: 'bg-amber-400',
  APPROVED: 'bg-violet-400',
  PUBLISHED: 'bg-emerald-400',
  REJECTED: 'bg-red-400',
};

function getTimeAgo(date: Date): string {
  try {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'recently';
  }
}

export default function ArticleCard({
  article,
  isAdmin = false,
  onDelete,
  isTopPerformer = false,
  isUpdating = false,
}: ArticleCardProps) {
  const config = STATUS_CONFIG[article.status] || STATUS_CONFIG.DRAFT;
  const dotClass = STATUS_DOT[article.status] || STATUS_DOT.DRAFT;
  const hasAnalytics = article.status === 'PUBLISHED' && (article.totalPageviews > 0 || article.totalUniqueVisitors > 0);
  const timeAgo = getTimeAgo(new Date(article.updatedAt));

  // Mobile: all cards use dark background — text is always light
  const mobileHeadlineClass = 'text-white';
  const mobileSubheadlineClass = 'text-white/60';
  const mobileMetaClass = 'text-white/50';
  const mobileBorderClass = isTopPerformer ? 'border-amber-500/30' : 'border-white/10';
  const mobileIconClass = 'text-white/40 group-active:text-press-400';
  const mobileStatusClass = config.mobileClass;

  return (
    <div
      className={`rounded-xl md:rounded-xl border transition-all duration-200 group relative ${
        isTopPerformer
          ? 'bg-ink-800/70 md:bg-gradient-to-br md:from-amber-50 md:to-orange-50 md:dark:from-amber-900/20 md:dark:to-orange-900/20 border-l-[3px] border-l-amber-500 border-ink-600/50 md:border-l-0 md:border-transparent md:shadow-lg md:shadow-amber-100/50 md:dark:shadow-amber-900/30 md:ring-2 md:ring-amber-400/30 md:dark:ring-amber-600/30'
          : 'bg-ink-800/70 md:bg-white md:dark:bg-ink-900 border-ink-600/50 md:border-ink-100 md:dark:border-ink-800 hover:shadow-card-hover md:hover:border-ink-200 md:dark:hover:border-ink-700'
      }`}
    >
      {/* Top Performer Badge - Desktop: absolute corner badge */}
      {isTopPerformer && (
        <div className="absolute -top-2 -right-2 z-10 hidden md:block">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-xs font-bold shadow-lg shadow-amber-500/30">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Top Performer
          </div>
        </div>
      )}

      <Link href={`/editor/${article.id}`} className="block active:scale-[0.98] md:active:scale-100 transition-transform">
        <div className="p-4 md:p-5">
          {/* Mobile Header - Status Badge */}
          <div className="flex items-center justify-between mb-3 md:hidden">
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${mobileStatusClass} border`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {article.status}
                </span>
              </div>
              {isTopPerformer && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                  <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Top</span>
                </div>
              )}
            </div>
            {article.status === 'PUBLISHED' && article.totalPageviews > 0 && (
              <div className={`flex items-center gap-1 ${isTopPerformer ? 'text-amber-400' : 'text-emerald-400'}`}>
                <HiOutlineEye className="w-4 h-4" />
                <span className="text-sm font-semibold">{article.totalPageviews.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Desktop Layout */}
          <div className="flex items-start gap-4">
            {/* Featured image thumbnail - Desktop only */}
            {article.featuredImage && (
              <div className="hidden md:block relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-ink-100">
                <Image
                  src={article.featuredImage}
                  alt={article.headline || 'Article image'}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              {/* Desktop Header */}
              <div className="hidden md:flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-ink-900 dark:text-ink-100 text-lg group-hover:text-press-700 dark:group-hover:text-press-400 transition-colors line-clamp-2">
                    {article.headline}
                  </h3>
                  {article.subHeadline && (
                    <p className="text-ink-500 dark:text-ink-400 text-sm mt-0.5 truncate">
                      {article.subHeadline}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`status-badge ${config.class}`}>
                    {config.label}
                  </span>
                </div>
              </div>

              {/* Mobile Headline - FIXED: Conditional text color */}
              <h3 className={`md:hidden text-base font-bold line-clamp-2 leading-snug mb-2 group-active:text-press-400 transition-colors ${mobileHeadlineClass}`}>
                {article.headline}
              </h3>

              {/* Mobile Subheadline - FIXED: Conditional text color */}
              {article.subHeadline && (
                <p className={`md:hidden text-sm line-clamp-2 leading-relaxed mb-3 ${mobileSubheadlineClass}`}>
                  {article.subHeadline}
                </p>
              )}

              {/* Desktop Meta */}
              <div className="hidden md:flex items-center gap-4 mt-3 text-xs text-ink-400">
                {isAdmin && (
                  <span className="flex items-center gap-1">
                    By {article.author.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <HiOutlineClock className="w-3.5 h-3.5" />
                  {new Date(article.updatedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                {article.tags && article.tags.length > 0 && (
                  <span className="flex items-center gap-1">
                    {article.tags.slice(0, 3).map((t) => t.tag.name).join(', ')}
                    {article.tags.length > 3 && ` +${article.tags.length - 3}`}
                  </span>
                )}
                {article.publishedUrl && (
                  <a
                    href={article.publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-press-600 hover:text-press-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View published →
                  </a>
                )}
              </div>

              {/* Mobile Footer - FIXED: Conditional text colors */}
              <div className={`flex md:hidden items-center justify-between pt-3 border-t ${mobileBorderClass}`}>
                <div className={`flex items-center gap-2 text-xs ${mobileMetaClass}`}>
                  <span>{article.author?.name || 'Unknown'}</span>
                  <span className={isTopPerformer ? 'text-amber-400/50' : 'text-white/30'}>•</span>
                  <span>{timeAgo}</span>
                </div>
                <div className={`transition-colors ${mobileIconClass}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              {/* Desktop Analytics row */}
              {hasAnalytics && (
                <div className="hidden md:flex items-center gap-4 mt-3 pt-3 border-t border-ink-100">
                  <div className="flex items-center gap-1.5 text-xs">
                    <HiOutlineChartBarSquare className={`w-4 h-4 ${isTopPerformer ? 'text-amber-600' : 'text-press-600'}`} />
                    <span className={`font-semibold ${isTopPerformer ? 'text-amber-700 text-base' : 'text-ink-900'}`}>
                      {article.totalPageviews.toLocaleString()}
                    </span>
                    <span className="text-ink-400">pageviews</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <HiOutlineEye className={`w-4 h-4 ${isTopPerformer ? 'text-amber-600' : 'text-blue-600'}`} />
                    <span className={`font-semibold ${isTopPerformer ? 'text-amber-700 text-base' : 'text-ink-900'}`}>
                      {article.totalUniqueVisitors.toLocaleString()}
                    </span>
                    <span className="text-ink-400">unique visitors</span>
                  </div>
                  {article.analyticsUpdatedAt && (
                    <span className="text-xs text-ink-300">
                      Updated {new Date(article.analyticsUpdatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Delete button - Desktop only, for admins */}
      {isAdmin && onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(article.id, article.headline);
          }}
          className="hidden md:block absolute top-4 right-4 p-2 rounded-lg text-ink-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
          title="Delete story"
        >
          <HiOutlineTrash className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
