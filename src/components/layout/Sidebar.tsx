'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HiOutlineNewspaper,
  HiOutlinePencilSquare,
  HiOutlineClipboardDocumentCheck,
  HiOutlineUserGroup,
  HiOutlineGlobeAlt,
  HiOutlineArrowRightOnRectangle,
  HiOutlinePlusCircle,
  HiOutlineArrowTrendingUp,
} from 'react-icons/hi2';

interface TrendingTopic {
  rank: number;
  name: string;
  url: string;
  tweet_volume: number | null;
  heat: number;
  sources: string[];
  velocity?: 'rising' | 'steady' | 'new' | 'falling';
}

interface TrendingData {
  updated_at: string | null;
  location: string;
  trends: TrendingTopic[];
}

function formatVolume(volume: number | null): string {
  if (!volume) return '';
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(0)}K`;
  return `${volume}`;
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getHeatLevel(heat: number): 'blazing' | 'hot' | 'warm' | 'normal' {
  if (heat >= 80) return 'blazing';
  if (heat >= 55) return 'hot';
  if (heat >= 35) return 'warm';
  return 'normal';
}

function FireIcon({ heat, className = '' }: { heat: number; className?: string }) {
  const level = getHeatLevel(heat);
  if (level === 'normal') return null;
  
  const colors = {
    blazing: 'text-orange-400',
    hot: 'text-orange-400/80',
    warm: 'text-amber-500/60',
  };
  
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`${colors[level]} ${className} ${level === 'blazing' ? 'animate-pulse' : ''}`}
    >
      <path d="M8 1.5c0 0-2.5 2.5-2.5 5.5 0 1.5.7 2.3 1.2 2.7-.2-.8 0-2.2 1.3-3.2 0 0 .2 2.5 1.8 3.8.5.4.7 1 .7 1.7h.1c1.4-.4 2.4-1.7 2.4-3.2C13 5 8 1.5 8 1.5z" />
    </svg>
  );
}

function SourceBadges({ sources }: { sources: string[] }) {
  if (!sources || sources.length <= 1) return null;
  
  const badges: Record<string, { label: string; color: string }> = {
    fox: { label: 'FOX', color: 'bg-blue-500/20 text-blue-300' },
    cfp: { label: 'CFP', color: 'bg-emerald-500/20 text-emerald-300' },
  };
  
  const newsSourceBadges = sources
    .filter(s => s !== 'x' && badges[s])
    .map(s => badges[s]);
    
  if (newsSourceBadges.length === 0) return null;
  
  return (
    <span className="inline-flex gap-0.5 ml-1">
      {newsSourceBadges.map((badge, i) => (
        <span
          key={i}
          className={`text-[8px] font-bold px-1 py-px rounded ${badge.color} leading-none`}
        >
          {badge.label}
        </span>
      ))}
    </span>
  );
}

function SidebarTrending() {
  const [data, setData] = useState<TrendingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchTrending = async () => {
      try {
        const res = await fetch('/api/trending');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (isMounted) {
          setData(json);
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setData(null);
          setIsLoading(false);
        }
      }
    };

    fetchTrending();
    const interval = setInterval(fetchTrending, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-2 px-2 mb-3">
          <div className="w-4 h-4 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-7 rounded-md bg-white/5 animate-pulse mb-1.5" />
        ))}
      </div>
    );
  }

  if (!data || data.trends.length === 0) return null;

  return (
    <div className="mx-3 mt-4 mb-3 p-3 rounded-lg bg-gradient-to-br from-blue-950/20 to-ink-950/30 border border-white/5 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div className="flex items-center gap-1.5">
          <HiOutlineArrowTrendingUp className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-semibold text-ink-300 uppercase tracking-wider">
            Trending Now
          </span>
        </div>
        {data.updated_at && (
          <span className="text-[10px] text-ink-500">
            {timeAgo(data.updated_at)}
          </span>
        )}
      </div>

      {/* Trend Items */}
      <div className="space-y-0.5">
        {data.trends.slice(0, 5).map((trend) => {
          const heat = trend.heat || 0;
          const heatLevel = getHeatLevel(heat);

          // Dynamic styles based on heat
          const rowStyle: React.CSSProperties = {};
          let rowClassName = 'flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-150 group';

          if (heatLevel === 'blazing') {
            rowClassName += ' hover:bg-white/10';
            rowStyle.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(251, 146, 60, 0.06))';
            rowStyle.boxShadow = 'inset 0 0 0 1px rgba(239, 68, 68, 0.15), 0 0 12px rgba(239, 68, 68, 0.08)';
          } else if (heatLevel === 'hot') {
            rowClassName += ' hover:bg-white/10';
            rowStyle.background = 'linear-gradient(135deg, rgba(251, 146, 60, 0.06), transparent)';
            rowStyle.boxShadow = 'inset 0 0 0 1px rgba(251, 146, 60, 0.1)';
          } else if (heatLevel === 'warm') {
            rowClassName += ' hover:bg-white/5';
            rowStyle.background = 'rgba(251, 191, 36, 0.03)';
          } else {
            rowClassName += ' hover:bg-white/5';
          }

          return (
            <div key={trend.rank} className={rowClassName} style={rowStyle}>
              {/* Rank or Fire icon */}
              <div className="w-4 flex-shrink-0 flex items-center justify-center">
                {heatLevel !== 'normal' ? (
                  <FireIcon heat={heat} className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-[10px] font-mono text-ink-500 text-center">
                    {trend.rank}
                  </span>
                )}
              </div>

              {/* Topic name + metadata */}
              <a
                href={`https://news.google.com/search?q=${encodeURIComponent(trend.name)}&hl=en-US&gl=US&ceid=US:en`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 cursor-pointer"
                title="Read news sources"
              >
                <div className="flex items-center gap-1">
                  <p className={`text-xs font-medium truncate transition-colors ${
                    heatLevel === 'blazing'
                      ? 'text-orange-300 group-hover:text-orange-200'
                      : heatLevel === 'hot'
                      ? 'text-ink-200 group-hover:text-white'
                      : 'text-ink-300 group-hover:text-white'
                  }`}>
                    {trend.name}
                  </p>
                  {trend.velocity === 'rising' && (
                    <svg viewBox="0 0 8 8" className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0">
                      <path d="M4 1L7 5H1L4 1Z" fill="currentColor" />
                    </svg>
                  )}
                  {trend.velocity === 'new' && (
                    <span className="text-[8px] font-bold text-press-400 bg-press-500/15 px-1 rounded flex-shrink-0">
                      NEW
                    </span>
                  )}
                  {trend.velocity === 'falling' && (
                    <svg viewBox="0 0 8 8" className="w-2.5 h-2.5 text-red-400/80 flex-shrink-0">
                      <path d="M4 7L7 3H1L4 7Z" fill="currentColor" />
                    </svg>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {trend.tweet_volume ? (
                    <p className="text-[10px] text-ink-500 leading-tight">
                      {formatVolume(trend.tweet_volume)} posts
                    </p>
                  ) : null}
                  <SourceBadges sources={trend.sources || ['x']} />
                </div>
              </a>

              {/* X link on hover */}
              <a
                href={trend.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all flex-shrink-0"
                title="View on X"
              >
                <svg className="w-3 h-3 text-ink-400 hover:text-press-400 transition-colors" viewBox="0 0 1200 1227" fill="currentColor">
                  <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"/>
                </svg>
              </a>
            </div>
          );
        })}
      </div>

      {/* See all link */}
      <a
        href="https://x.com/explore/tabs/trending"
        target="_blank"
        rel="noopener noreferrer"
        className="block px-2 mt-2 text-[11px] text-press-500/70 hover:text-press-400 transition-colors"
      >
        See all trends →
      </a>
    </div>
  );
}

interface HotArticle {
  id: string;
  headline: string;
  slug: string;
  totalPageviews: number;
  totalUniqueVisitors: number;
  publishedUrl: string;
  rankChange: number | null; // positive = moved up, negative = moved down, null = new
  isNew: boolean;
}

function BestPerformingPosts() {
  const [articles, setArticles] = useState<HotArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHotArticles = async () => {
      try {
        const res = await fetch('/api/articles/hot-today');
        const data = await res.json();
        setArticles(data.articles || []);
      } catch (error) {
        console.error('Failed to fetch hot articles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHotArticles();
    // Refresh every 5 minutes
    const interval = setInterval(fetchHotArticles, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading || articles.length === 0) return null;

  return (
    <div className="mx-3 mb-3 p-3 rounded-lg bg-gradient-to-br from-amber-950/15 to-orange-950/10 border border-amber-500/10 shadow-[inset_0_1px_1px_rgba(251,191,36,0.05)]">
      {/* Header with chart icon */}
      <div className="flex items-center gap-1.5 px-1 mb-2.5">
        <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <span className="text-[11px] font-semibold text-amber-300/90 uppercase tracking-wider">
          Best Performing
        </span>
        <div className="flex-1"></div>
        <span className="text-[9px] text-amber-500/60 font-medium">24H</span>
      </div>

      {/* Article Items */}
      <div className="space-y-1">
        {articles.map((article, index) => (
          <Link
            key={article.id}
            href={`/editor/${article.id}`}
            className="flex items-start gap-2.5 px-2 py-2 rounded-md bg-white/[0.02] hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all duration-200 group"
          >
            {/* Rank with premium gradient badge */}
            <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500/25 to-orange-500/25 border border-amber-400/30 shadow-sm shadow-amber-500/20">
              <span className="text-[11px] font-bold text-amber-200">
                {index + 1}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium text-amber-100/80 group-hover:text-amber-50 transition-colors line-clamp-2 leading-snug flex-1">
                  {article.headline}
                </p>
                {/* Trending indicators */}
                {article.isNew && (
                  <span className="text-[8px] font-bold text-press-400 bg-press-500/15 px-1 rounded flex-shrink-0">
                    NEW
                  </span>
                )}
                {!article.isNew && article.rankChange !== null && article.rankChange > 0 && (
                  <svg viewBox="0 0 8 8" className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0">
                    <path d="M4 1L7 5H1L4 1Z" fill="currentColor" />
                  </svg>
                )}
                {!article.isNew && article.rankChange !== null && article.rankChange < 0 && (
                  <svg viewBox="0 0 8 8" className="w-2.5 h-2.5 text-red-400/80 flex-shrink-0">
                    <path d="M4 7L7 3H1L4 7Z" fill="currentColor" />
                  </svg>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-amber-400/60 group-hover:text-amber-400/80 transition-colors flex items-center gap-0.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {article.totalPageviews.toLocaleString()}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
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
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.filter((item) => item.show).map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href.split('?')[0]));
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                ${isActive ? 'bg-press-500/15 text-press-400' : 'text-ink-300 hover:bg-white/5 hover:text-white'}`}>
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-press-400' : ''}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Trending Topics */}
      <SidebarTrending />

      {/* Subtle divider */}
      <div className="mx-3 my-2 border-t border-white/5"></div>

      {/* Best Performing Posts - Top articles from last 24h */}
      <BestPerformingPosts />

      {/* User Section */}
      <div className="mt-4 p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-press-500/20 flex items-center justify-center">
            <span className="text-press-400 text-xs font-semibold">
              {session.user.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{session.user.name}</p>
            <p className="text-ink-500 text-xs capitalize">{session.user.role.toLowerCase()}</p>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-ink-400 hover:text-press-400 text-sm transition-colors w-full px-1">
          <HiOutlineArrowRightOnRectangle className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

