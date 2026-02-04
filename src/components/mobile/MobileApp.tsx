'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  HiOutlineHome,
  HiOutlinePlusCircle,
  HiOutlineChartBarSquare,
  HiOutlineUser,
  HiOutlineArrowPath,
  HiOutlineFire,
  HiOutlineEye,
  HiOutlineCheckCircle,
  HiOutlinePencilSquare,
  HiOutlineClock,
  HiOutlineArrowTrendingUp,
  HiOutlineSparkles,
  HiOutlineLightBulb,
  HiOutlineArrowTopRightOnSquare,
} from 'react-icons/hi2';

interface Article {
  id: string;
  headline: string;
  subHeadline?: string;
  status: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  totalPageviews: number;
  totalUniqueVisitors: number;
  author: { name: string };
}

interface StoryIdea {
  headline: string;
  sourceUrl: string;
  source: string;
  trending?: boolean;
}

export default function MobileApp() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('home');
  const [articles, setArticles] = useState<Article[]>([]);
  const [hotArticles, setHotArticles] = useState<Article[]>([]);
  const [storyIdeas, setStoryIdeas] = useState<StoryIdea[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const [stats, setStats] = useState({ total: 0, published: 0, drafts: 0, totalViews: 0 });

  // IMPORTANT: All hooks must be defined before any early returns to comply with Rules of Hooks
  const fetchArticles = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeFilter) params.set('status', activeFilter);
      params.set('limit', '100');
      const res = await fetch(`/api/articles?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setArticles(data.articles || []);

      const all = data.articles || [];
      setStats({
        total: all.length,
        published: all.filter((a: Article) => a.status === 'PUBLISHED').length,
        drafts: all.filter((a: Article) => a.status === 'DRAFT').length,
        totalViews: all.reduce((sum: number, a: Article) => sum + (a.totalPageviews || 0), 0),
      });
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      setArticles([]);
    }
  }, [activeFilter]);

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
      if (!res.ok) throw new Error('Failed to fetch story ideas');
      const data = await res.json();
      setStoryIdeas(data.ideas || []);
    } catch (error) {
      console.error('Failed to fetch story ideas:', error);
      setStoryIdeas([]);
    }
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch data when session is available
  useEffect(() => {
    if (session) {
      fetchArticles();
      fetchHotArticles();
      fetchStoryIdeas();
    }
  }, [session, fetchArticles, fetchHotArticles, fetchStoryIdeas]);

  // Show loading while checking auth - AFTER all hooks are defined
  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ink-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-press-400" />
      </div>
    );
  }

  if (!session) return null;

  const isAdmin = ['ADMIN', 'EDITOR'].includes(session.user?.role || '');

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

  if (activeTab === 'home') {
    return (
      <div
        className="min-h-screen bg-slate-900 pb-20"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull to Refresh Indicator */}
        {pullDistance > 0 && (
          <div
            className="fixed top-0 left-0 right-0 flex items-center justify-center z-50 transition-opacity"
            style={{
              height: `${pullDistance}px`,
              opacity: pullDistance / 100
            }}
          >
            <div className="bg-slate-800/90 backdrop-blur-xl rounded-full p-2">
              <HiOutlineArrowPath
                className={`w-6 h-6 text-press-400 ${pullDistance > 60 ? 'animate-spin' : ''}`}
                style={{ transform: `rotate(${pullDistance * 3.6}deg)` }}
              />
            </div>
          </div>
        )}

        {/* Sticky Header */}
        <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl">
          <div className="px-4 pt-3 pb-4">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-white to-press-400 bg-clip-text text-transparent">
                  NewsRoom
                </h1>
                <p className="text-xs text-white/60 mt-0.5 flex items-center gap-1">
                  <HiOutlineSparkles className="w-3 h-3" />
                  {session?.user?.name || 'User'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('profile')}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-press-500 to-press-600 flex items-center justify-center ring-2 ring-press-400/20 active:scale-95 transition-transform"
              >
                <span className="text-white text-sm font-bold">
                  {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </button>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl p-3 bg-slate-800/80 border border-blue-400/40">
                <div className="text-2xl font-bold text-blue-300">{stats.total}</div>
                <div className="text-[10px] text-white/70 uppercase tracking-wider font-medium mt-0.5">Total</div>
              </div>
              <div className="rounded-xl p-3 bg-slate-800/80 border border-emerald-400/40">
                <div className="text-2xl font-bold text-emerald-300">{stats.published}</div>
                <div className="text-[10px] text-white/70 uppercase tracking-wider font-medium mt-0.5">Live</div>
              </div>
              <div className="rounded-xl p-3 bg-slate-800/80 border border-orange-400/40">
                <div className="text-2xl font-bold text-orange-300">
                  {stats.totalViews > 999 ? `${(stats.totalViews / 1000).toFixed(1)}k` : stats.totalViews}
                </div>
                <div className="text-[10px] text-white/70 uppercase tracking-wider font-medium mt-0.5">Views</div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
              {[
                { label: 'All', value: null, icon: HiOutlineHome },
                { label: 'Published', value: 'PUBLISHED', icon: HiOutlineCheckCircle },
                { label: 'Drafts', value: 'DRAFT', icon: HiOutlinePencilSquare },
                ...(isAdmin ? [{ label: 'Review', value: 'SUBMITTED', icon: HiOutlineClock }] : []),
              ].map((filter) => {
                const Icon = filter.icon;
                const isActive = activeFilter === filter.value;
                return (
                  <button
                    key={filter.label}
                    onClick={() => setActiveFilter(filter.value)}
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
          {articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-ink-800 to-ink-900 flex items-center justify-center mb-4 ring-1 ring-white/10">
                <HiOutlinePlusCircle className="w-10 h-10 text-white/40" />
              </div>
              <p className="text-white/80 text-base font-medium">No stories yet</p>
              <p className="text-white/50 text-sm mt-1">Tap the + button to create your first</p>
            </div>
          ) : (
            articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))
          )}
        </div>

        {/* Floating Action Button */}
        <Link
          href="/editor/new"
          className="fixed bottom-24 right-5 z-50 group"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-press-500 to-press-600 rounded-full blur-xl opacity-60 group-active:opacity-80 transition-opacity" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-press-500 to-press-600 shadow-2xl shadow-press-500/40 flex items-center justify-center ring-4 ring-ink-950 group-active:scale-90 transition-transform">
              <HiOutlinePlusCircle className="w-8 h-8 text-white" />
            </div>
          </div>
        </Link>

        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  if (activeTab === 'hot') {
    return (
      <HotTodayTab
        hotArticles={hotArticles}
        storyIdeas={storyIdeas}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    );
  }

  if (activeTab === 'analytics') {
    return (
      <AnalyticsTab 
        stats={stats} 
        articles={articles}
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
    );
  }

  if (activeTab === 'profile') {
    return (
      <ProfileTab 
        session={session}
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
    );
  }

  return null;
}

function ArticleCard({ article }: { article: Article }) {
  const router = useRouter();
  
  const getStatusConfig = (status: string) => {
    const configs = {
      PUBLISHED: {
        color: 'from-emerald-500/25 to-emerald-600/15 border-emerald-400/40 text-emerald-300',
        dot: 'bg-emerald-400'
      },
      DRAFT: {
        color: 'from-slate-500/25 to-slate-600/15 border-slate-400/40 text-slate-200',
        dot: 'bg-slate-300'
      },
      SUBMITTED: {
        color: 'from-blue-500/25 to-blue-600/15 border-blue-400/40 text-blue-300',
        dot: 'bg-blue-400 animate-pulse'
      },
      APPROVED: {
        color: 'from-violet-500/25 to-violet-600/15 border-violet-400/40 text-violet-300',
        dot: 'bg-violet-400'
      },
    };
    return configs[status as keyof typeof configs] || configs.DRAFT;
  };

  const statusConfig = getStatusConfig(article.status);
  const timeAgo = getTimeAgo(new Date(article.updatedAt));

  return (
    <div
      onClick={() => router.push(`/editor/${article.id}`)}
      className="group active:scale-[0.98] transition-transform"
    >
      <div className="relative overflow-hidden rounded-2xl bg-slate-800/70 border border-slate-600/50 group-active:border-slate-500/70 transition-colors">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${statusConfig.color} border`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {article.status}
              </span>
            </div>
            {article.status === 'PUBLISHED' && article.totalPageviews > 0 && (
              <div className="flex items-center gap-1 text-emerald-400">
                <HiOutlineEye className="w-4 h-4" />
                <span className="text-sm font-semibold">{article.totalPageviews.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Headline */}
          <h3 className="text-base font-bold text-white line-clamp-2 leading-snug mb-2 group-active:text-press-400 transition-colors">
            {article.headline}
          </h3>

          {/* Subheadline */}
          {article.subHeadline && (
            <p className="text-sm text-white/60 line-clamp-2 leading-relaxed mb-3">
              {article.subHeadline}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <span>{article.author?.name || 'Unknown'}</span>
              <span className="text-white/30">•</span>
              <span>{timeAgo}</span>
            </div>
            <div className="text-white/40 group-active:text-press-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HotTodayTab({ hotArticles = [], storyIdeas = [], activeTab, onTabChange }: any) {
  const [showAllHot, setShowAllHot] = useState(false);

  // Ensure arrays are valid before operations
  const safeHotArticles = Array.isArray(hotArticles) ? hotArticles : [];
  const safeStoryIdeas = Array.isArray(storyIdeas) ? storyIdeas : [];

  const displayedArticles = showAllHot ? safeHotArticles : safeHotArticles.slice(0, 3);
  const hasMoreArticles = safeHotArticles.length > 3;

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50">
        <div className="px-4 pt-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <HiOutlineFire className="w-6 h-6 text-orange-400 animate-pulse" />
            <h1 className="text-2xl font-bold text-white">Hot Today</h1>
          </div>
          <p className="text-sm text-white/70">Most read posts from the past 24 hours</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {safeHotArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <HiOutlineFire className="w-12 h-12 text-white/30 mb-3" />
            <p className="text-white/80">No hot articles today</p>
            <p className="text-white/50 text-sm mt-1">Check back soon</p>
          </div>
        ) : (
          <>
            {displayedArticles.map((article: Article, index: number) => (
              <div key={article.id} className="relative">
                <Link href={`/editor/${article.id}`}>
                  <div className="group active:scale-[0.98] transition-transform">
                    <div className="relative overflow-hidden rounded-2xl bg-slate-800/80 border border-orange-500/40">
                      <div className="p-4">
                        <div className="absolute top-3 right-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/40">
                            <span className="text-white text-sm font-bold">{index + 1}</span>
                          </div>
                        </div>

                        <h3 className="text-base font-bold text-white line-clamp-2 leading-snug mb-2 pr-10">
                          {article.headline}
                        </h3>

                        {article.author?.name && (
                          <p className="text-xs text-white/50 mb-2">
                            by <span className="text-white/70 font-medium">{article.author.name}</span>
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1 text-orange-300 font-semibold">
                            <HiOutlineEye className="w-4 h-4" />
                            <span>{(article.totalPageviews || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1 text-white/60">
                            <HiOutlineArrowTrendingUp className="w-4 h-4" />
                            <span>{article.totalUniqueVisitors || 0} unique</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}

            {hasMoreArticles && (
              <button
                onClick={() => setShowAllHot(!showAllHot)}
                className="w-full py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white/70 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                {showAllHot ? (
                  <>Show Less</>
                ) : (
                  <>
                    <span>Show {safeHotArticles.length - 3} More</span>
                    <span className="text-orange-400">#{4}-{safeHotArticles.length}</span>
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Story Ideas Section */}
      {safeStoryIdeas.length > 0 && (
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <HiOutlineLightBulb className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-bold text-white">Story Ideas</h2>
          </div>
          <p className="text-xs text-white/50 mb-3">Trending topics from around the web</p>
          <div className="space-y-2">
            {safeStoryIdeas.slice(0, 5).map((idea: StoryIdea, index: number) => (
              <a
                key={index}
                href={idea.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <div className="group active:scale-[0.98] transition-transform">
                  <div className={`p-3 rounded-xl relative overflow-hidden ${
                    idea.trending
                      ? 'bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/50 ring-1 ring-purple-400/20'
                      : 'bg-slate-800/60 border border-yellow-500/20 group-active:border-yellow-500/40'
                  }`}>
                    {idea.trending && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-bl-lg">
                          Multi-Source
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-medium line-clamp-2 leading-snug ${
                          idea.trending ? 'text-white pr-16' : 'text-white/90'
                        }`}>
                          {idea.headline}
                        </h4>
                        <div className="flex items-center gap-2 mt-1.5">
                          {idea.trending && (
                            <span className="flex items-center gap-1 text-[10px] text-purple-300 font-semibold">
                              <HiOutlineArrowTrendingUp className="w-3 h-3" />
                              HOT
                            </span>
                          )}
                          <span className={`text-[10px] uppercase tracking-wider font-medium ${
                            idea.trending ? 'text-purple-300/80' : 'text-yellow-400/80'
                          }`}>
                            {idea.source}
                          </span>
                          <HiOutlineArrowTopRightOnSquare className="w-3 h-3 text-white/40" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

function AnalyticsTab({ stats, articles, activeTab, onTabChange }: any) {
  const publishedArticles = articles.filter((a: Article) => a.status === 'PUBLISHED');
  const topArticles = publishedArticles
    .sort((a: Article, b: Article) => (b.totalPageviews || 0) - (a.totalPageviews || 0))
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50">
        <div className="px-4 pt-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <HiOutlineChartBarSquare className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
          </div>
          <p className="text-sm text-white/70">Performance overview</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-blue-400/40">
            <div className="text-3xl font-bold text-blue-300 mb-1">{stats.totalViews.toLocaleString()}</div>
            <div className="text-xs text-white/70 uppercase tracking-wider font-medium">Total Views</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-emerald-400/40">
            <div className="text-3xl font-bold text-emerald-300 mb-1">{stats.published}</div>
            <div className="text-xs text-white/70 uppercase tracking-wider font-medium">Published</div>
          </div>
        </div>

        {topArticles.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3 px-1">
              Top Performers
            </h2>
            <div className="space-y-2">
              {topArticles.map((article: Article, index: number) => (
                <Link key={article.id} href={`/editor/${article.id}`}>
                  <div className="group active:scale-[0.98] transition-transform">
                    <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-600/50 group-active:border-slate-500/70">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/30 flex items-center justify-center border-2 border-blue-400/60">
                          <span className="text-sm font-bold text-blue-200">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-white line-clamp-1 mb-1">
                            {article.headline}
                          </h3>
                          <div className="flex items-center gap-1 text-sm text-emerald-400 font-medium">
                            <HiOutlineEye className="w-4 h-4" />
                            {(article.totalPageviews || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

function ProfileTab({ session, activeTab, onTabChange }: any) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900 pb-20">
      <div className="px-4 pt-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-press-500 to-press-600 flex items-center justify-center ring-4 ring-press-400/30 mb-4">
            <span className="text-white text-3xl font-bold">
              {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{session?.user?.name || 'User'}</h1>
          <p className="text-sm text-white/60">{session?.user?.email || ''}</p>
          <div className="mt-3 px-3 py-1 rounded-full bg-press-500/20 border border-press-400/30">
            <span className="text-xs font-semibold text-press-300 uppercase tracking-wider">
              {session?.user?.role || 'USER'}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => signOut()}
            className="w-full p-4 rounded-xl bg-red-500/20 border border-red-400/30 text-red-300 font-semibold active:scale-[0.98] transition-transform"
          >
            Sign Out
          </button>
        </div>
      </div>

      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

function BottomNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: HiOutlineHome },
    { id: 'hot', label: 'Hot', icon: HiOutlineFire },
    { id: 'analytics', label: 'Analytics', icon: HiOutlineChartBarSquare },
    { id: 'profile', label: 'Profile', icon: HiOutlineUser },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-3 mb-3 rounded-2xl bg-ink-900/98 backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-around p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center gap-1 px-5 py-2.5 rounded-xl transition-all active:scale-95 ${
                  isActive ? 'bg-white/15' : ''
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-white/50'}`} />
                <span className={`text-[10px] font-semibold ${isActive ? 'text-white' : 'text-white/40'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  try {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return 'recently';
  }
}
