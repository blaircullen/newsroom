'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import BottomNav from '@/components/layout/BottomNav';
import ArticleCard, { Article } from '@/components/dashboard/ArticleCard';
import StatsGrid from '@/components/dashboard/StatsGrid';
import HotSection, { StoryIdea } from '@/components/dashboard/HotSection';
import AnalyticsSection from '@/components/dashboard/AnalyticsSection';
import ProfileSection from '@/components/dashboard/ProfileSection';
import {
  HiOutlineDocumentText,
  HiOutlinePlusCircle,
  HiOutlineArrowPath,
  HiOutlineLightBulb,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineSparkles,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineArrowTrendingUp,
  HiOutlineHome,
  HiOutlineCheckCircle,
  HiOutlinePencilSquare,
  HiOutlineClock,
  HiOutlineExclamationTriangle,
  HiOutlineXMark,
} from 'react-icons/hi2';

type TabId = 'home' | 'hot' | 'analytics' | 'profile';

const FILTERS = [
  { value: '', label: 'All Stories' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'REVISION_REQUESTED', label: 'Needs Revision' },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [articles, setArticles] = useState<Article[]>([]);
  const [hotArticles, setHotArticles] = useState<Article[]>([]);
  const [storyIdeas, setStoryIdeas] = useState<StoryIdea[]>([]);
  const [stats, setStats] = useState({ total: 0, submitted: 0, approved: 0, published: 0, drafts: 0, totalViews: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; headline: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshingAnalytics, setIsRefreshingAnalytics] = useState(false);
  const [showStoryIdeas, setShowStoryIdeas] = useState(false);
  const [creatingFromIdea, setCreatingFromIdea] = useState<string | null>(null);
  const [showAllHot, setShowAllHot] = useState(false);

  // Pull-to-refresh state (mobile)
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'EDITOR';

  // Handle tab change (state only - no URL update to avoid hydration issues)
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
  };

  // Fetch functions
  const fetchArticles = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeFilter) params.set('status', activeFilter);
      params.set('page', currentPage.toString());
      params.set('sortBy', sortBy);

      const [filteredRes, statsRes] = await Promise.all([
        fetch(`/api/articles?${params}`),
        fetch('/api/articles/stats'),
      ]);

      const [filteredData, statsData] = await Promise.all([
        filteredRes.json(),
        statsRes.json(),
      ]);

      const allArticles = filteredData.articles || [];
      setArticles(allArticles);
      setTotalPages(filteredData.pagination?.pages || 1);

      setStats({
        total: statsData.total || 0,
        submitted: statsData.submitted || 0,
        approved: statsData.approved || 0,
        published: statsData.published || 0,
        drafts: statsData.drafts || allArticles.filter((a: Article) => a.status === 'DRAFT').length,
        totalViews: allArticles.reduce((sum: number, a: Article) => sum + (a.totalPageviews || 0), 0),
      });
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      setArticles([]);
    } finally {
      setIsLoading(false);
      setIsAutoRefreshing(false);
    }
  }, [activeFilter, currentPage, sortBy]);

  const fetchHotArticles = useCallback(async () => {
    try {
      const res = await fetch('/api/articles/hot-today');
      if (!res.ok) throw new Error('Failed to fetch hot articles');
      const data = await res.json();
      setHotArticles(data.articles || []);
    } catch (error) {
      console.error('Failed to fetch hot articles:', error);
      setHotArticles([]);
    }
  }, []);

  const fetchStoryIdeas = useCallback(async () => {
    try {
      const res = await fetch('/api/story-ideas');
      if (res.ok) {
        const data = await res.json();
        setStoryIdeas(data.ideas || []);
      }
    } catch (error) {
      console.error('Failed to fetch story ideas:', error);
    }
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch data
  useEffect(() => {
    if (session) {
      setIsLoading(true);
      fetchArticles();
      fetchHotArticles();
      fetchStoryIdeas();

      // Auto-refresh every 30 seconds
      const interval = setInterval(() => {
        setIsAutoRefreshing(true);
        fetchArticles();
      }, 30000);

      // Refresh story ideas every 15 minutes
      const ideasInterval = setInterval(fetchStoryIdeas, 15 * 60 * 1000);

      return () => {
        clearInterval(interval);
        clearInterval(ideasInterval);
      };
    }
  }, [session, fetchArticles, fetchHotArticles, fetchStoryIdeas]);

  // Pull-to-refresh handlers
  const handlePullToRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchArticles(), fetchHotArticles(), fetchStoryIdeas()]);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing) {
      const currentY = e.touches[0].clientY;
      const distance = currentY - touchStartY.current;
      if (distance > 0) {
        setPullDistance(Math.min(distance, 100));
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60) {
      handlePullToRefresh();
    }
    setPullDistance(0);
  };

  // Other handlers
  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setCurrentPage(1);
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

  const handleCreateFromIdea = async (idea: StoryIdea) => {
    setCreatingFromIdea(idea.headline);
    try {
      // Step 1: Use AI to generate article content from the source URL
      toast.loading('Generating article with AI...', { id: 'ai-import' });

      const importRes = await fetch('/api/articles/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: idea.sourceUrl }),
      });

      if (!importRes.ok) {
        const errorData = await importRes.json();
        throw new Error(errorData.error || 'Failed to generate article');
      }

      const aiContent = await importRes.json();
      toast.dismiss('ai-import');

      // Step 2: Create the article with AI-generated content
      const sourceDomain = new URL(idea.sourceUrl).hostname.replace(/^www\./, '');
      const sourceLink = `<p><em>Source: <a href="${idea.sourceUrl}" target="_blank" rel="noopener noreferrer">${sourceDomain}</a></em></p>`;

      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: aiContent.headline,
          subHeadline: aiContent.subHeadline || null,
          bodyContent: aiContent.bodyText || '',
          bodyHtml: aiContent.bodyHtml + sourceLink,
        }),
      });

      if (!res.ok) throw new Error('Failed to create article');

      const newArticle = await res.json();

      // Remove this idea from the list
      setStoryIdeas(prev => prev.filter(i => i.headline !== idea.headline));

      toast.success('AI article generated! Review before publishing.');
      router.push(`/editor/${newArticle.id}`);
    } catch (error) {
      toast.dismiss('ai-import');
      const message = error instanceof Error ? error.message : 'Failed to generate article';
      toast.error(message);
    } finally {
      setCreatingFromIdea(null);
    }
  };

  // Loading state
  if (status === 'loading' || status === 'unauthenticated' || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ink-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-press-400" />
      </div>
    );
  }

  // Calculate top performers for desktop view
  const publishedArticles = articles.filter(a => a.status === 'PUBLISHED' && a.totalPageviews > 0);
  const pageviewsArray = publishedArticles.map(a => a.totalPageviews).sort((a, b) => a - b);
  const medianPageviews = pageviewsArray.length > 0 ? pageviewsArray[Math.floor(pageviewsArray.length / 2)] : 0;
  const topPerformerThreshold = medianPageviews * 2.5;

  return (
    <AppShell hideOnMobile>
      {/* Mobile View Container */}
      <div
        className="md:hidden min-h-screen pb-24"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull to Refresh Indicator */}
        {pullDistance > 0 && (
          <div
            className="fixed top-0 left-0 right-0 flex items-center justify-center z-50 transition-opacity"
            style={{ height: `${pullDistance}px`, opacity: pullDistance / 100 }}
          >
            <div className="bg-slate-800/90 backdrop-blur-xl rounded-full p-2">
              <HiOutlineArrowPath
                className={`w-6 h-6 text-press-400 ${pullDistance > 60 ? 'animate-spin' : ''}`}
                style={{ transform: `rotate(${pullDistance * 3.6}deg)` }}
              />
            </div>
          </div>
        )}

        {/* Home Tab - Mobile */}
        {activeTab === 'home' && (
          <div className="bg-slate-900">
            {/* Mobile Header */}
            <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl">
              <div className="px-4 pt-3 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-start gap-0">
                      <span className="font-black text-[32px] leading-none tracking-[-2px] text-white">N</span>
                      <span className="font-black text-[32px] leading-none tracking-[-2px] text-press-500">R</span>
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" className="ml-0.5 mt-0.5">
                        <path d="M10 0l2.5 6.9H20l-6 4.6 2.3 7L10 13.8l-6.3 4.7 2.3-7-6-4.6h7.5z" fill="#D42B2B"/>
                      </svg>
                    </div>
                    <p className="text-xs text-white/60 mt-0.5">
                      {session?.user?.name || 'User'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleTabChange('profile')}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-press-500 to-press-600 flex items-center justify-center ring-2 ring-press-400/20 active:scale-95 transition-transform"
                  >
                    <span className="text-white text-sm font-bold">
                      {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </button>
                </div>

                {/* Mobile Stats */}
                <StatsGrid stats={stats} isAdmin={isAdmin} isUpdating={isAutoRefreshing} />

                {/* Filter Pills */}
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
                  {[
                    { label: 'All', value: null, icon: HiOutlineHome },
                    { label: 'Published', value: 'PUBLISHED', icon: HiOutlineCheckCircle },
                    { label: 'Drafts', value: 'DRAFT', icon: HiOutlinePencilSquare },
                    ...(isAdmin ? [{ label: 'Review', value: 'SUBMITTED', icon: HiOutlineClock }] : []),
                  ].map((filter) => {
                    const Icon = filter.icon;
                    const isActive = activeFilter === filter.value || (activeFilter === '' && filter.value === null);
                    return (
                      <button
                        key={filter.label}
                        onClick={() => handleFilterChange(filter.value || '')}
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                          isActive
                            ? 'bg-white text-ink-950 shadow-lg shadow-white/20'
                            : 'bg-white/10 text-white/70 border border-white/20 active:bg-white/15'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {filter.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Article Feed */}
            <div className="px-4 space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin w-8 h-8 border-2 border-ink-200 border-t-press-500 rounded-full" />
                </div>
              ) : articles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-ink-800 to-ink-900 flex items-center justify-center mb-4 ring-1 ring-white/10">
                    <HiOutlinePlusCircle className="w-10 h-10 text-white/40" />
                  </div>
                  <p className="text-white/80 text-base font-medium">No stories yet</p>
                  <p className="text-white/50 text-sm mt-1">Tap the + button to create your first</p>
                </div>
              ) : (
                articles.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    isAdmin={isAdmin}
                    onDelete={(id, headline) => setDeleteConfirm({ id, headline })}
                    isTopPerformer={article.status === 'PUBLISHED' && article.totalPageviews >= topPerformerThreshold && topPerformerThreshold > 0}
                    isUpdating={isAutoRefreshing}
                  />
                ))
              )}
            </div>

            {/* Mobile FAB */}
            <Link href="/editor" className="fixed bottom-24 right-5 z-50 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-press-500 to-press-600 rounded-full blur-xl opacity-60 group-active:opacity-80 transition-opacity" />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-press-500 to-press-600 shadow-2xl shadow-press-500/40 flex items-center justify-center ring-4 ring-ink-950 group-active:scale-90 transition-transform">
                  <HiOutlinePlusCircle className="w-8 h-8 text-white" />
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Hot Tab - Mobile */}
        {activeTab === 'hot' && (
          <div className="bg-slate-900 min-h-screen px-4 pt-4">
            <HotSection
              hotArticles={hotArticles}
              storyIdeas={storyIdeas}
              showAllHot={showAllHot}
              setShowAllHot={setShowAllHot}
              onDismissIdea={(idea) => setStoryIdeas(prev => prev.filter(i => i.headline !== idea.headline))}
            />
          </div>
        )}

        {/* Analytics Tab - Mobile */}
        {activeTab === 'analytics' && (
          <div className="min-h-screen">
            <AnalyticsSection stats={stats} articles={articles} />
          </div>
        )}

        {/* Profile Tab - Mobile */}
        {activeTab === 'profile' && (
          <div className="bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900 min-h-screen px-4 pt-8">
            <ProfileSection session={session} />
          </div>
        )}

        {/* Mobile Bottom Nav - consistent dark nav across all tabs */}
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-display-md text-ink-950 dark:text-ink-100">
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
            {(activeFilter === '' || activeFilter === 'PUBLISHED') && articles.length > 0 && (
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="appearance-none pl-4 pr-10 py-2.5 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 rounded-lg font-semibold text-sm hover:bg-ink-50 dark:hover:bg-ink-800 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-ink-300 dark:focus:ring-ink-600"
                >
                  <option value="createdAt">Newest First</option>
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
            {isAdmin && (activeFilter === '' || activeFilter === 'PUBLISHED') && (
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

        {/* Desktop Stats */}
        <StatsGrid stats={stats} isAdmin={isAdmin} isUpdating={isAutoRefreshing} />

        {/* Story Ideas Panel - Desktop (Admin only) */}
        {isAdmin && storyIdeas.length > 0 && (
          <div className="mb-8 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-800 flex items-center justify-center">
                <HiOutlineLightBulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-ink-900 dark:text-ink-100">
                  Story Ideas
                </h3>
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  {storyIdeas.length} trending topics from around the web
                </p>
              </div>
            </div>

            <div className="px-5 pb-5">
              <div className="grid grid-cols-3 gap-3">
                {storyIdeas.slice(0, showStoryIdeas ? storyIdeas.length : 3).map((idea, index) => (
                    <div
                      key={index}
                      className={`rounded-lg p-4 hover:shadow-md transition-all group relative overflow-hidden ${
                        idea.trending
                          ? 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-press-300 dark:border-press-700 ring-1 ring-press-200 dark:ring-press-800'
                          : 'bg-white dark:bg-ink-900 border border-amber-200/50 dark:border-amber-800/50'
                      }`}
                    >
                      {/* Dismiss button */}
                      <button
                        onClick={() => setStoryIdeas(prev => prev.filter(i => i.headline !== idea.headline))}
                        className={`absolute top-2 right-2 p-1 rounded-full transition-colors z-10 opacity-0 group-hover:opacity-100 ${
                          idea.trending
                            ? 'top-8 text-press-400 hover:text-press-600 hover:bg-press-100 dark:hover:bg-press-900'
                            : 'text-ink-400 hover:text-ink-600 hover:bg-ink-100 dark:hover:bg-ink-800'
                        }`}
                        title="Dismiss suggestion"
                      >
                        <HiOutlineXMark className="w-4 h-4" />
                      </button>
                      {idea.trending && (
                        <div className="absolute top-0 right-0">
                          <div className="bg-gradient-to-r from-press-500 to-orange-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-bl-lg flex items-center gap-1">
                            <HiOutlineArrowTrendingUp className="w-3 h-3" />
                            Multi-Source
                          </div>
                        </div>
                      )}
                      <h4 className={`text-sm font-medium line-clamp-2 mb-3 leading-snug ${
                        idea.trending
                          ? 'text-press-900 dark:text-red-100 pr-20'
                          : 'text-ink-800 dark:text-ink-200'
                      }`}>
                        {idea.headline}
                      </h4>
                      <div className="flex items-center justify-between">
                        <a
                          href={idea.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1 text-xs hover:underline ${
                            idea.trending
                              ? 'text-press-600 dark:text-press-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          <span className="uppercase tracking-wider font-medium">{idea.source}</span>
                          <HiOutlineArrowTopRightOnSquare className="w-3 h-3" />
                        </a>
                        <button
                          onClick={() => handleCreateFromIdea(idea)}
                          disabled={creatingFromIdea === idea.headline}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-all active:scale-95 ${
                            idea.trending
                              ? 'bg-gradient-to-r from-press-600 to-orange-500 hover:from-press-700 hover:to-orange-600'
                              : 'bg-ink-950 dark:bg-ink-700 hover:bg-ink-800 dark:hover:bg-ink-600'
                          }`}
                        >
                          {creatingFromIdea === idea.headline ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <HiOutlineSparkles className="w-3.5 h-3.5" />
                              Write This
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {storyIdeas.length > 3 && (
                  <button
                    onClick={() => setShowStoryIdeas(!showStoryIdeas)}
                    className="w-full mt-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center justify-center gap-1 transition-colors"
                  >
                    {showStoryIdeas ? (
                      <>
                        <HiOutlineChevronUp className="w-4 h-4" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <HiOutlineChevronDown className="w-4 h-4" />
                        Show {storyIdeas.length - 3} More
                      </>
                    )}
                  </button>
                )}
              </div>
          </div>
        )}

        {/* Filter tabs - Desktop */}
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

        {/* Articles List - Desktop */}
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
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                isAdmin={isAdmin}
                onDelete={(id, headline) => setDeleteConfirm({ id, headline })}
                isTopPerformer={article.status === 'PUBLISHED' && article.totalPageviews >= topPerformerThreshold && topPerformerThreshold > 0}
                isUpdating={isAutoRefreshing}
              />
            ))}
          </div>
        )}

        {/* Pagination - Desktop only */}
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
      </div>

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
