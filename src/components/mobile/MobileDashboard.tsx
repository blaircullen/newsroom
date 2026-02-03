'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  HiOutlineHome,
  HiOutlinePlusCircle,
  HiOutlineChartBarSquare,
  HiOutlineUser,
  HiOutlineArrowPath,
  HiOutlineFire,
  HiOutlineEye,
} from 'react-icons/hi2';

interface Article {
  id: string;
  headline: string;
  subHeadline?: string;
  status: string;
  publishedAt?: string;
  totalPageviews: number;
  totalUniqueVisitors: number;
  featuredImage?: string;
  author: { name: string };
}

export default function MobileDashboard() {
  const { data: session } = useSession();
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeTab, setActiveTab] = useState('home');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, published: 0, drafts: 0, totalViews: 0 });

  const fetchArticles = async () => {
    try {
      const params = new URLSearchParams();
      if (activeFilter) params.set('status', activeFilter);
      const res = await fetch(`/api/articles?${params}&limit=50`);
      const data = await res.json();
      setArticles(data.articles || []);
      
      // Calculate stats
      const all = data.articles || [];
      setStats({
        total: all.length,
        published: all.filter((a: Article) => a.status === 'PUBLISHED').length,
        drafts: all.filter((a: Article) => a.status === 'DRAFT').length,
        totalViews: all.reduce((sum: number, a: Article) => sum + a.totalPageviews, 0),
      });
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [activeFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchArticles();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const statusFilters = [
    { label: 'All Stories', value: null },
    { label: 'Published', value: 'PUBLISHED' },
    { label: 'Drafts', value: 'DRAFT' },
    { label: 'Submitted', value: 'SUBMITTED' },
  ];

  const getStatusColor = (status: string) => {
    const colors = {
      PUBLISHED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      DRAFT: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      SUBMITTED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      APPROVED: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    };
    return colors[status as keyof typeof colors] || colors.DRAFT;
  };

  if (activeTab === 'home') {
    return (
      <div className="min-h-screen bg-ink-950 pb-20">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-gradient-to-b from-ink-950 via-ink-950 to-ink-950/95 backdrop-blur-xl border-b border-white/5">
          <div className="px-4 pt-safe">
            <div className="flex items-center justify-between py-4">
              <div>
                <h1 className="text-xl font-bold text-white">NewsRoom</h1>
                <p className="text-xs text-ink-400 mt-0.5">Your Stories</p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2.5 rounded-full bg-white/5 active:bg-white/10 transition-colors"
              >
                <HiOutlineArrowPath className={`w-5 h-5 text-ink-300 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 pb-4">
              <div className="bg-gradient-to-br from-blue-950/30 to-blue-900/20 rounded-xl p-3 border border-blue-500/10">
                <div className="text-2xl font-bold text-blue-400">{stats.total}</div>
                <div className="text-[10px] text-blue-300/60 uppercase tracking-wide mt-0.5">Stories</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-950/30 to-emerald-900/20 rounded-xl p-3 border border-emerald-500/10">
                <div className="text-2xl font-bold text-emerald-400">{stats.published}</div>
                <div className="text-[10px] text-emerald-300/60 uppercase tracking-wide mt-0.5">Published</div>
              </div>
              <div className="bg-gradient-to-br from-orange-950/30 to-orange-900/20 rounded-xl p-3 border border-orange-500/10">
                <div className="text-2xl font-bold text-orange-400">{stats.totalViews.toLocaleString()}</div>
                <div className="text-[10px] text-orange-300/60 uppercase tracking-wide mt-0.5">Views</div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none">
              {statusFilters.map((filter) => (
                <button
                  key={filter.label}
                  onClick={() => setActiveFilter(filter.value)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    activeFilter === filter.value
                      ? 'bg-white text-ink-950'
                      : 'bg-white/5 text-ink-300 active:bg-white/10'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Article List */}
        <div className="px-4 pt-4 space-y-3">
          {articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <HiOutlinePlusCircle className="w-8 h-8 text-ink-500" />
              </div>
              <p className="text-ink-400 text-sm">No stories yet</p>
              <p className="text-ink-600 text-xs mt-1">Tap + to create your first story</p>
            </div>
          ) : (
            articles.map((article) => (
              <Link
                key={article.id}
                href={`/editor/${article.id}`}
                className="block group active:scale-[0.98] transition-transform"
              >
                <div className="bg-gradient-to-br from-white/[0.03] to-white/[0.01] rounded-2xl border border-white/5 overflow-hidden active:border-white/10 transition-colors">
                  {/* Image */}
                  {article.featuredImage && (
                    <div className="aspect-[2/1] bg-ink-900 overflow-hidden">
                      <img
                        src={article.featuredImage}
                        alt=""
                        className="w-full h-full object-cover group-active:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="p-4">
                    {/* Status & Analytics */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(article.status)}`}>
                        {article.status}
                      </span>
                      {article.status === 'PUBLISHED' && article.totalPageviews > 0 && (
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1 text-ink-400">
                            <HiOutlineEye className="w-3.5 h-3.5" />
                            {article.totalPageviews.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Headline */}
                    <h3 className="text-base font-semibold text-white line-clamp-2 leading-snug mb-1">
                      {article.headline}
                    </h3>

                    {/* Subheadline */}
                    {article.subHeadline && (
                      <p className="text-sm text-ink-400 line-clamp-2 leading-relaxed">
                        {article.subHeadline}
                      </p>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                      <span className="text-xs text-ink-500">{article.author.name}</span>
                      {article.publishedAt && (
                        <>
                          <span className="text-ink-700">•</span>
                          <span className="text-xs text-ink-500">
                            {new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Floating Action Button */}
        <Link
          href="/editor/new"
          className="fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-press-500 to-press-600 shadow-xl shadow-press-500/30 flex items-center justify-center active:scale-95 transition-transform"
        >
          <HiOutlinePlusCircle className="w-7 h-7 text-white" />
        </Link>

        {/* Bottom Navigation */}
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  // Other tabs would render different views
  return (
    <div className="min-h-screen bg-ink-950 pb-20">
      <div className="flex items-center justify-center h-screen">
        <p className="text-ink-400">Tab: {activeTab}</p>
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

function BottomNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: HiOutlineHome },
    { id: 'analytics', label: 'Analytics', icon: HiOutlineChartBarSquare },
    { id: 'hot', label: 'Hot Today', icon: HiOutlineFire },
    { id: 'profile', label: 'Profile', icon: HiOutlineUser },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="bg-ink-900/95 backdrop-blur-xl border-t border-white/10">
        <div className="flex items-center justify-around px-2 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  isActive ? 'bg-white/10' : 'active:bg-white/5'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'text-press-400' : 'text-ink-400'}`} />
                <span className={`text-[10px] font-medium ${isActive ? 'text-press-400' : 'text-ink-500'}`}>
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
