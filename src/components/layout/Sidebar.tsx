'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineArrowTrendingUp,
  HiOutlineMagnifyingGlass,
} from 'react-icons/hi2';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { getNavItemsForRole, isNavItemActive } from '@/lib/navigation';

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
    <div className="mx-3 mb-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
      {/* Tab Headers */}
      <div className="flex items-center gap-1 mb-3 p-1 bg-white/5 rounded-lg">
        {hasArticles && (
          <button
            onClick={() => setActiveTab('top')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'top'
                ? 'bg-press-500/20 text-press-400'
                : 'text-ink-400 hover:text-ink-200 hover:bg-white/5'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Top Posts
          </button>
        )}
        {hasTrending && (
          <button
            onClick={() => setActiveTab('trending')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'trending'
                ? 'bg-sky-500/20 text-sky-400'
                : 'text-ink-400 hover:text-ink-200 hover:bg-white/5'
            }`}
          >
            <HiOutlineArrowTrendingUp className="w-4 h-4" />
            Social Trends
          </button>
        )}
      </div>

      {/* Top Posts Content */}
      {activeTab === 'top' && hasArticles && (
        <div className="space-y-1">
          {articles.slice(0, 5).map((article, i) => (
            <Link
              key={article.id}
              href={`/editor/${article.id}`}
              className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
            >
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-xs font-bold text-amber-300 flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink-200 group-hover:text-white line-clamp-2 transition-colors leading-snug">
                  {article.headline}
                </p>
                <p className="text-xs text-ink-500 mt-1">
                  {article.totalPageviews.toLocaleString()} views
                </p>
              </div>
              {article.isNew && (
                <span className="text-[9px] font-bold text-press-400 bg-press-500/20 px-1.5 py-0.5 rounded flex-shrink-0">
                  NEW
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Social Trends Content */}
      {activeTab === 'trending' && hasTrending && (
        <div className="space-y-1">
          {trending.trends.slice(0, 5).map((trend, i) => (
            <a
              key={trend.rank}
              href={`https://news.google.com/search?q=${encodeURIComponent(trend.name)}&hl=en-US&gl=US&ceid=US:en`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
            >
              <span className="w-6 h-6 rounded-full bg-sky-500/20 text-xs font-bold text-sky-300 flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-ink-200 group-hover:text-white flex-1 line-clamp-1 transition-colors">
                {trend.name}
              </span>
              {trend.velocity === 'new' && (
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded flex-shrink-0">
                  NEW
                </span>
              )}
              {trend.velocity === 'rising' && (
                <svg viewBox="0 0 8 8" className="w-3 h-3 text-emerald-400 flex-shrink-0">
                  <path d="M4 1L7 5H1L4 1Z" fill="currentColor" />
                </svg>
              )}
            </a>
          ))}
          <a
            href="https://x.com/explore/tabs/trending"
            target="_blank"
            rel="noopener noreferrer"
            className="block px-2 pt-2 text-xs text-ink-500 hover:text-sky-400 transition-colors"
          >
            See all on X →
          </a>
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  const navItems = getNavItemsForRole(session.user.role);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col z-40 bg-gradient-to-b from-ink-950 to-ink-900">
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
      <nav className="py-4 px-3 space-y-0.5" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = isNavItemActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${isActive ? 'bg-press-500/15 text-press-400' : 'text-ink-200 hover:bg-white/5 hover:text-white'}
                focus:outline-none focus:ring-2 focus:ring-press-500/50 focus:ring-offset-2 focus:ring-offset-ink-900`}
              aria-current={isActive ? 'page' : undefined}>
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-press-400' : ''}`} />
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
            className="p-1.5 rounded-md text-ink-400 hover:text-press-400 hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-press-500/50"
            title="Sign out"
            aria-label="Sign out"
          >
            <HiOutlineArrowRightOnRectangle className="w-4 h-4" />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
