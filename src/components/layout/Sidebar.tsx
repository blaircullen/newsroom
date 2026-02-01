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

function SidebarTrending() {
  const [data, setData] = useState<TrendingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await fetch('/api/trending');
        if (!res.ok) throw new Error();
        setData(await res.json());
      } catch {
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrending();
    const interval = setInterval(fetchTrending, 5 * 60 * 1000);
    return () => clearInterval(interval);
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
    <div className="px-3 py-4 border-t border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-1.5">
          <HiOutlineArrowTrendingUp className="w-3.5 h-3.5 text-press-400" />
          <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">
            Trending on 𝕏
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
        {data.trends.map((trend) => (
          <a
            key={trend.rank}
            href={trend.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-white/5 transition-all duration-150 group cursor-pointer"
          >
            <span className="text-[10px] font-mono text-ink-500 w-3 text-right flex-shrink-0">
              {trend.rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-ink-300 group-hover:text-white truncate transition-colors">
                {trend.name}
              </p>
            </div>
            {trend.tweet_volume && (
              <span className="text-[10px] text-ink-500 flex-shrink-0">
                {formatVolume(trend.tweet_volume)}
              </span>
            )}
          </a>
        ))}
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

      {/* User Section */}
      <div className="p-4 border-t border-white/10">
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
