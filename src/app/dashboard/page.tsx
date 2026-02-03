'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, Suspense } from 'react';

// Dynamically import MobileApp with no SSR to prevent hook issues
const MobileApp = dynamic(() => import('@/components/mobile/MobileApp'), {
  ssr: false,
});

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import {
  HiOutlineDocumentText,
  HiOutlinePaperAirplane,
  HiOutlineCheckCircle,
  HiOutlineGlobeAlt,
  HiOutlinePencilSquare,
  HiOutlineEye,
  HiOutlineClock,
  HiOutlinePlusCircle,
  HiOutlineFunnel,
  HiOutlineTrash,
  HiOutlineExclamationTriangle,
  HiOutlineArrowPath,
  HiOutlineChartBarSquare,
} from 'react-icons/hi2';

const STATUS_CONFIG: Record<string, { label: string; class: string; icon: React.ComponentType<{ className?: string }> }> = {
  DRAFT: { label: 'Draft', class: 'status-draft', icon: HiOutlineDocumentText },
  SUBMITTED: { label: 'Submitted', class: 'status-submitted', icon: HiOutlinePaperAirplane },
  IN_REVIEW: { label: 'In Review', class: 'status-in-review', icon: HiOutlineEye },
  REVISION_REQUESTED: { label: 'Needs Revision', class: 'status-revision-requested', icon: HiOutlinePencilSquare },
  APPROVED: { label: 'Approved', class: 'status-approved', icon: HiOutlineCheckCircle },
  PUBLISHED: { label: 'Published', class: 'status-published', icon: HiOutlineGlobeAlt },
  REJECTED: { label: 'Rejected', class: 'status-rejected', icon: HiOutlineDocumentText },
};

const FILTERS = [
  { value: '', label: 'All Stories' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'REVISION_REQUESTED', label: 'Needs Revision' },
];

interface Article {
  id: string;
  headline: string;
  subHeadline?: string;
  status: string;
  featuredImage?: string;
  publishedUrl?: string;
  totalPageviews: number;
  totalUniqueVisitors: number;
  analyticsUpdatedAt?: string;
  updatedAt: string;
  author: { name: string };
  tags: { tag: { name: string } }[];
}

function DesktopDashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter') || '';

  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState({ total: 0, submitted: 0, approved: 0, published: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState(filterParam);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; headline: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshingAnalytics, setIsRefreshingAnalytics] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'EDITOR';

  const fetchArticles = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilter) params.set('status', activeFilter);
      params.set('page', currentPage.toString());
      params.set('sortBy', sortBy);

      // Fetch filtered articles and stats in parallel for better performance
      // Use dedicated stats endpoint to avoid loading all articles
      const [filteredRes, statsRes] = await Promise.all([
        fetch(`/api/articles?${params}`),
        fetch('/api/articles/stats'),
      ]);

      const [filteredData, statsData] = await Promise.all([
        filteredRes.json(),
        statsRes.json(),
      ]);

      setArticles(filteredData.articles || []);
      setTotalPages(filteredData.pagination?.pages || 1);

      // Stats are now calculated server-side efficiently
      setStats({
        total: statsData.total || 0,
        submitted: statsData.submitted || 0,
        approved: statsData.approved || 0,
        published: statsData.published || 0,
      });
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    } finally {
      setIsLoading(false);
      setIsAutoRefreshing(false);
    }
  };

  useEffect(() => {
    fetchArticles();
    
    // Auto-refresh every 30 seconds for live updates
    const interval = setInterval(() => {
      setIsAutoRefreshing(true);
      fetchArticles();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [activeFilter, currentPage, sortBy]);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setCurrentPage(1); // Reset to page 1 when changing filters
    const url = filter ? `/dashboard?filter=${filter.toLowerCase()}` : '/dashboard';
    router.replace(url, { scroll: false });
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      toast.success('Story deleted');
      setDeleteConfirm(null);
      fetchArticles();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete';
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefreshAnalytics = async () => {
    setIsRefreshingAnalytics(true);
    try {
      const res = await fetch('/api/analytics/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to refresh analytics');
      }

      const data = await res.json();
      toast.success(data.message || 'Analytics refreshed');
      fetchArticles();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh analytics';
      toast.error(message);
    } finally {
      setIsRefreshingAnalytics(false);
    }
  };

  return (
    <AppShell>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-display-md text-ink-950">
            {isAdmin ? 'Editorial Dashboard' : 'My Stories'}
          </h1>
          <p className="text-ink-400 mt-1">
            {isAdmin
              ? 'Review and manage all submitted stories'
              : 'Write, edit, and track your stories'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort dropdown */}
          {(activeFilter === null || activeFilter === 'PUBLISHED') && articles.length > 0 && (
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-4 pr-10 py-2.5 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 rounded-lg font-semibold text-sm hover:bg-ink-50 dark:hover:bg-ink-800 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600"
              >
                <option value="updatedAt">Recent Updates</option>
                <option value="publishedAt">Recently Published</option>
                <option value="pageviews">Most Pageviews</option>
                <option value="visitors">Most Visitors</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-ink-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}
          {isAdmin && (activeFilter === null || activeFilter === 'PUBLISHED') && (
            <button
              onClick={handleRefreshAnalytics}
              disabled={isRefreshingAnalytics}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 rounded-lg font-semibold text-sm hover:bg-ink-50 dark:hover:bg-ink-800 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <HiOutlineArrowPath className={`w-5 h-5 ${isRefreshingAnalytics ? 'animate-spin' : ''}`} />
              {isRefreshingAnalytics ? 'Refreshing...' : 'Refresh Analytics'}
            </button>
          )}
          <Link
            href="/editor"
            className="flex items-center gap-2 px-5 py-2.5 bg-ink-950 text-paper-100 rounded-lg font-semibold text-sm hover:bg-ink-800 transition-all active:scale-[0.98]"
          >
            <HiOutlinePlusCircle className="w-5 h-5" />
            New Story
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Stories"
          value={stats.total}
          icon={HiOutlineDocumentText}
          color="ink"
          isUpdating={isAutoRefreshing}
        />
        <StatCard
          label={isAdmin ? 'Awaiting Review' : 'Submitted'}
          value={stats.submitted}
          icon={HiOutlinePaperAirplane}
          color="blue"
          highlight={isAdmin && stats.submitted > 0}
          isUpdating={isAutoRefreshing}
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          icon={HiOutlineCheckCircle}
          color="emerald"
          isUpdating={isAutoRefreshing}
        />
        <StatCard
          label="Published"
          value={stats.published}
          icon={HiOutlineGlobeAlt}
          color="press"
          isUpdating={isAutoRefreshing}
        />
      </div>


      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-1.5 w-fit">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => handleFilterChange(filter.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeFilter === filter.value
                ? 'bg-ink-950 text-paper-100 dark:bg-ink-700 dark:text-ink-100'
                : 'text-ink-500 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800 hover:text-ink-700 dark:hover:text-ink-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Articles List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-ink-200 border-t-press-500 rounded-full" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800">
          <HiOutlineDocumentText className="w-12 h-12 text-ink-200 dark:text-ink-600 mx-auto mb-4" />
          <h3 className="font-display text-lg text-ink-700 dark:text-ink-200 mb-2">
            {activeFilter ? 'No stories with this status' : 'No stories yet'}
          </h3>
          <p className="text-ink-400 text-sm mb-6">
            {activeFilter
              ? 'Try a different filter or create a new story.'
              : 'Start writing your first story.'}
          </p>
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink-950 dark:bg-ink-700 text-paper-100 rounded-lg font-semibold text-sm"
          >
            <HiOutlinePlusCircle className="w-5 h-5" />
            Write a Story
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            // Calculate high-performing articles
            const publishedArticles = articles.filter(a => a.status === 'PUBLISHED' && a.totalPageviews > 0);
            const pageviewsArray = publishedArticles.map(a => a.totalPageviews).sort((a, b) => a - b);
            const medianPageviews = pageviewsArray.length > 0
              ? pageviewsArray[Math.floor(pageviewsArray.length / 2)]
              : 0;
            const topPerformerThreshold = medianPageviews * 2.5; // 2.5x median

            return articles.map((article) => {
            const config = STATUS_CONFIG[article.status] || STATUS_CONFIG.DRAFT;
            const hasAnalytics = article.status === 'PUBLISHED' && (article.totalPageviews > 0 || article.totalUniqueVisitors > 0);
            const isTopPerformer = article.status === 'PUBLISHED' && article.totalPageviews >= topPerformerThreshold && topPerformerThreshold > 0;
            return (
              <div
                key={article.id}
                className={`rounded-xl border transition-all duration-200 group relative p-5 ${
                  isTopPerformer
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-transparent shadow-lg shadow-amber-100/50 dark:shadow-amber-900/30 ring-2 ring-amber-400/30 dark:ring-amber-600/30'
                    : 'bg-white dark:bg-ink-900 border-ink-100 dark:border-ink-800 hover:shadow-card-hover hover:border-ink-200 dark:hover:border-ink-700'
                }`}
              >
                {isTopPerformer && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-xs font-bold shadow-lg shadow-amber-500/30">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Top Performer
                    </div>
                  </div>
                )}

                <Link
                  href={`/editor/${article.id}`}
                  className="block"
                >
                  <div className="flex items-start gap-4">
                    {/* Featured image thumbnail */}
                    {article.featuredImage && (
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-ink-100">
                        <img
                          src={article.featuredImage}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="font-display font-semibold text-ink-900 dark:text-ink-100 text-lg group-hover:text-press-700 dark:group-hover:text-press-400 transition-colors truncate">
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

                      <div className="flex items-center gap-4 mt-3 text-xs text-ink-400">
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
                        {article.tags.length > 0 && (
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

                      {/* Analytics row */}
                      {hasAnalytics && (
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-ink-100">
                          <div className="flex items-center gap-1.5 text-xs">
                            <HiOutlineChartBarSquare className={`w-4 h-4 ${isTopPerformer ? 'text-amber-600' : 'text-press-600'}`} />
                            <span className={`font-semibold ${isTopPerformer ? 'text-amber-700 text-base' : 'text-ink-900'}`}>
                              <AnimatedNumber value={article.totalPageviews} isUpdating={isAutoRefreshing} />
                            </span>
                            <span className="text-ink-400">pageviews</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <HiOutlineEye className={`w-4 h-4 ${isTopPerformer ? 'text-amber-600' : 'text-blue-600'}`} />
                            <span className={`font-semibold ${isTopPerformer ? 'text-amber-700 text-base' : 'text-ink-900'}`}>
                              <AnimatedNumber value={article.totalUniqueVisitors} isUpdating={isAutoRefreshing} />
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
                </Link>

                {/* Delete button for admins */}
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteConfirm({ id: article.id, headline: article.headline });
                    }}
                    className="absolute top-4 right-4 p-2 rounded-lg text-ink-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete story"
                  >
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          });
          })()}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 px-4">
          <div className="text-sm text-ink-600 dark:text-ink-400">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-ink-700 dark:text-ink-200 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-ink-700 dark:text-ink-200 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                      currentPage === pageNum
                        ? 'bg-ink-950 dark:bg-ink-700 text-white'
                        : 'text-ink-700 dark:text-ink-200 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium text-ink-700 dark:text-ink-200 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium text-ink-700 dark:text-ink-200 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <HiOutlineExclamationTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="font-display text-lg font-semibold text-ink-900 dark:text-ink-100">
                Delete Story
              </h3>
            </div>
            <p className="text-ink-600 dark:text-ink-300 text-sm mb-2">
              Are you sure you want to delete this story?
            </p>
            <p className="text-ink-900 dark:text-ink-100 font-medium text-sm mb-4 bg-ink-50 dark:bg-ink-800 rounded-lg p-3">
              &ldquo;{deleteConfirm.headline}&rdquo;
            </p>
            <p className="text-ink-400 text-xs mb-6">
              This action cannot be undone. The article and all associated reviews and comments will be permanently removed.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-ink-200 bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-700 disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                disabled={isDeleting}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                {isDeleting ? 'Deleting...' : 'Delete Story'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// Stats Card Component
// Animated number component for smooth value transitions
function AnimatedNumber({ value, isUpdating = false }: { value: number; isUpdating?: boolean }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (displayValue !== value) {
      setIsAnimating(true);
      
      // Animate from current to new value
      const duration = 800; // ms
      const steps = 30;
      const stepDuration = duration / steps;
      const increment = (value - displayValue) / steps;
      let currentStep = 0;

      const timer = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          setDisplayValue(value);
          setIsAnimating(false);
          clearInterval(timer);
        } else {
          setDisplayValue(prev => prev + increment);
        }
      }, stepDuration);

      return () => clearInterval(timer);
    }
  }, [value, displayValue]);

  return (
    <span className={`transition-all duration-300 ${
      isAnimating ? 'scale-105 text-press-600' : 'scale-100'
    } ${isUpdating && !isAnimating ? 'opacity-80' : 'opacity-100'}`}>
      {Math.round(displayValue).toLocaleString()}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  highlight = false,
  isUpdating = false,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  highlight?: boolean;
  isUpdating?: boolean;
}) {
  const colorMap: Record<string, string> = {
    ink: 'bg-ink-50 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
    press: 'bg-press-50 text-press-600 dark:bg-press-900/40 dark:text-press-400',
  };

  return (
    <div className={`bg-white dark:bg-ink-900 rounded-xl border p-5 transition-all duration-300 ${
      highlight ? 'border-blue-200 dark:border-blue-800 shadow-card ring-1 ring-blue-100 dark:ring-blue-900' : 'border-ink-100 dark:border-ink-800'
    } ${isUpdating ? 'ring-2 ring-press-200/50 dark:ring-press-700/50' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]} transition-all duration-300 ${
          isUpdating ? 'scale-105' : 'scale-100'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
        {highlight && (
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
        )}
        {isUpdating && !highlight && (
          <span className="w-2 h-2 rounded-full bg-press-400 animate-pulse" />
        )}
      </div>
      <p className="text-2xl font-display font-bold text-ink-900 dark:text-ink-100">
        <AnimatedNumber value={value} isUpdating={isUpdating} />
      </p>
      <p className="text-xs text-ink-400 mt-0.5">{label}</p>
    </div>
  );
}


// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-ink-950">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-press-400" />
    </div>
  );
}

// Client-side mobile detection with proper hydration handling
export default function DashboardPage() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileUA = /iphone|ipad|ipod|android|blackberry|windows phone/g.test(userAgent);
      const isMobileScreen = window.innerWidth < 768;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      return (isMobileUA || isMobileScreen) && hasTouch;
    };

    setIsMobile(checkMobile());

    const handleResize = () => setIsMobile(checkMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Show loading until we detect device type (prevents hydration mismatch)
  if (isMobile === null) {
    return <LoadingSpinner />;
  }

  // Render mobile app (dynamically loaded, no SSR)
  if (isMobile) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <MobileApp />
      </Suspense>
    );
  }

  // Render desktop dashboard
  return <DesktopDashboard />;
}
