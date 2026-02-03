'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HiOutlineNewspaper,
  HiOutlineClipboardDocumentCheck,
  HiOutlineUserGroup,
  HiOutlineGlobeAlt,
  HiOutlineArrowRightOnRectangle,
  HiOutlinePlusCircle,
  HiOutlineArrowTrendingUp,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineMagnifyingGlass,
} from 'react-icons/hi2';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface TrendingTopic {
  rank: number;
  name: string;
  url: string;
  tweet_volume: number | null;
  heat: number;
  velocity?: 'rising' | 'steady' | 'new' | 'falling';
}

interface TrendingData {
  updated_at: string | null;
  trends: TrendingTopic[];
}

interface HotArticle {
  id: string;
  headline: string;
  totalPageviews: number;
  isNew: boolean;
  rankChange: number | null;
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// Unified Insights Panel with tabs
function InsightsPanel() {
  const [activeTab, setActiveTab] = useState<'trending' | 'top'>('top');
  const [trending, setTrending] = useState<TrendingData | null>(null);
  const [articles, setArticles] = useState<HotArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [trendingRes, articlesRes] = await Promise.all([
          fetch('/api/trending'),
          fetch('/api/articles/hot-today'),
        ]);

        if (isMounted) {
          if (trendingRes.ok) {
            const trendingData = await trendingRes.json();
            setTrending(trendingData);
          }
          if (articlesRes.ok) {
            const articlesData = await articlesRes.json();
            setArticles(articlesData.articles || []);
          }
          setIsLoading(false);
        }
      } catch {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="mx-3 mb-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <div className="flex gap-2 mb-3">
          <div className="h-6 w-16 rounded bg-white/10 animate-pulse" />
          <div className="h-6 w-16 rounded bg-white/10 animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 rounded bg-white/5 animate-pulse mb-1.5" />
        ))}
      </div>
    );
  }

  const hasTrending = trending && trending.trends.length > 0;
  const hasArticles = articles.length > 0;

  if (!hasTrending && !hasArticles) return null;

  return (
    <div className="mx-3 mb-3 p-2 rounded-lg bg-white/[0.02] border border-white/5">
      {/* Tab Headers */}
      <div className="flex items-center gap-1 mb-2 p-0.5 bg-white/5 rounded-md">
        {hasTrending && (
          <button
            onClick={() => setActiveTab('trending')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wide transition-all ${
              activeTab === 'trending'
                ? 'bg-white/10 text-white'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <HiOutlineArrowTrendingUp className="w-3 h-3" />
            Trending
          </button>
        )}
        {hasArticles && (
          <button
            onClick={() => setActiveTab('top')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wide transition-all ${
              activeTab === 'top'
                ? 'bg-white/10 text-white'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Top 24H
          </button>
        )}
      </div>

      {/* Trending Content */}
      {activeTab === 'trending' && hasTrending && (
        <div className="space-y-0.5">
          {trending.trends.slice(0, 3).map((trend, i) => (
            <a
              key={trend.rank}
              href={`https://news.google.com/search?q=${encodeURIComponent(trend.name)}&hl=en-US&gl=US&ceid=US:en`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors group"
            >
              <span className="w-4 text-[10px] font-mono text-ink-500 text-center flex-shrink-0">
                {i + 1}
              </span>
              <span className="text-xs text-ink-300 group-hover:text-white truncate flex-1 transition-colors">
                {trend.name}
              </span>
              {trend.velocity === 'new' && (
                <span className="text-[8px] font-bold text-press-400 bg-press-500/20 px-1 rounded flex-shrink-0">
                  NEW
                </span>
              )}
              {trend.velocity === 'rising' && (
                <svg viewBox="0 0 8 8" className="w-2 h-2 text-emerald-400 flex-shrink-0">
                  <path d="M4 1L7 5H1L4 1Z" fill="currentColor" />
                </svg>
              )}
            </a>
          ))}
          <a
            href="https://x.com/explore/tabs/trending"
            target="_blank"
            rel="noopener noreferrer"
            className="block px-2 pt-1 text-[10px] text-ink-500 hover:text-press-400 transition-colors"
          >
            See all on X →
          </a>
        </div>
      )}

      {/* Top Posts Content */}
      {activeTab === 'top' && hasArticles && (
        <div className="space-y-0.5">
          {articles.slice(0, 3).map((article, i) => (
            <Link
              key={article.id}
              href={`/editor/${article.id}`}
              className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors group"
            >
              <span className="w-4 h-4 rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink-300 group-hover:text-white truncate transition-colors leading-snug">
                  {article.headline}
                </p>
                <p className="text-[10px] text-ink-500 mt-0.5">
                  {article.totalPageviews.toLocaleString()} views
                </p>
              </div>
              {article.isNew && (
                <span className="text-[8px] font-bold text-press-400 bg-press-500/20 px-1 rounded flex-shrink-0">
                  NEW
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  const isAdmin = ['ADMIN', 'EDITOR'].includes(session.user.role);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: HiOutlineNewspaper, show: true },
    { href: '/editor/new', label: 'New Story', icon: HiOutlinePlusCircle, show: true },
    { href: '/dashboard?filter=submitted', label: 'For Review', icon: HiOutlineClipboardDocumentCheck, show: isAdmin },
    { href: '/calendar', label: 'Calendar', icon: HiOutlineCalendarDays, show: isAdmin },
    { href: '/analytics', label: 'Analytics', icon: HiOutlineChartBar, show: true },
    { href: '/admin/users', label: 'Manage Writers', icon: HiOutlineUserGroup, show: session.user.role === 'ADMIN' },
    { href: '/admin/sites', label: 'Publish Sites', icon: HiOutlineGlobeAlt, show: session.user.role === 'ADMIN' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col z-40"
           style={{ background: 'linear-gradient(180deg, #111c30 0%, #192842 100%)' }}>
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-white/10">
        <Link href="/dashboard" className="inline-flex items-center gap-0 group">
          <span className="font-black text-[28px] leading-none tracking-[-1.5px] text-white">N</span>
          <span className="font-black text-[28px] leading-none tracking-[-1.5px] text-press-500">R</span>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="ml-0.5 -mt-3 opacity-90 group-hover:opacity-100 transition-opacity">
            <path d="M10 0l2.5 6.9H20l-6 4.6 2.3 7L10 13.8l-6.3 4.7 2.3-7-6-4.6h7.5z" fill="#D42B2B"/>
          </svg>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="py-4 px-3 space-y-0.5">
        {navItems.filter((item) => item.show).map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href.split('?')[0]));
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${isActive ? 'bg-press-500/15 text-press-400' : 'text-ink-300 hover:bg-white/5 hover:text-white'}`}>
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-press-400' : ''}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Unified Insights Panel */}
      <InsightsPanel />

      {/* Quick Search Hint */}
      <div className="mx-3 mb-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 text-ink-400 text-xs">
          <HiOutlineMagnifyingGlass className="w-3.5 h-3.5" />
          <span>Quick search</span>
          <kbd className="ml-auto px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-mono">⌘K</kbd>
        </div>
      </div>

      {/* User Section - Compact */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-press-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-press-400 text-xs font-semibold">
              {session.user.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{session.user.name}</p>
            <p className="text-ink-500 text-[10px] capitalize">{session.user.role.toLowerCase()}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1.5 rounded-md text-ink-400 hover:text-press-400 hover:bg-white/5 transition-colors"
            title="Sign out"
          >
            <HiOutlineArrowRightOnRectangle className="w-4 h-4" />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
