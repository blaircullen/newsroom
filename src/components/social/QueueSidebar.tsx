'use client';

import { HiOutlineGlobeAlt } from 'react-icons/hi2';
import type { SocialPlatform, PostStatus } from '@/types/social';

interface QueueSidebarProps {
  stats: {
    failed: number;
    pending: number;
    approved: number;
    sentLast24h: number;
    sites: Array<{ id: string; name: string; faviconColor: string | null; postCount: number }>;
  };
  siteFilter: string | null;
  onSiteFilter: (siteId: string | null) => void;
  platformFilter: SocialPlatform | null;
  onPlatformFilter: (platform: SocialPlatform | null) => void;
  statusFilter: PostStatus | null;
  onStatusFilter: (status: PostStatus | null) => void;
  onConnectClick: () => void;
}

const platforms: { id: SocialPlatform; name: string; dotClass: string }[] = [
  { id: 'X', name: 'X', dotClass: 'bg-black border border-white/30' },
  { id: 'FACEBOOK', name: 'Facebook', dotClass: 'bg-blue-500' },
  { id: 'INSTAGRAM', name: 'Instagram', dotClass: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500' },
  { id: 'TRUTHSOCIAL', name: 'Truth Social', dotClass: 'bg-indigo-600' },
];

const statuses: { id: PostStatus | null; name: string; dotClass: string }[] = [
  { id: null, name: 'All', dotClass: 'bg-white/40' },
  { id: 'FAILED', name: 'Failed', dotClass: 'bg-red-400' },
  { id: 'PENDING', name: 'Pending', dotClass: 'bg-amber-400' },
  { id: 'APPROVED', name: 'Approved', dotClass: 'bg-blue-400' },
  { id: 'SENT', name: 'Sent', dotClass: 'bg-emerald-400' },
];

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return name.substring(0, 2).toUpperCase();
  }
  return words
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase();
}

export default function QueueSidebar({
  stats,
  siteFilter,
  onSiteFilter,
  platformFilter,
  onPlatformFilter,
  statusFilter,
  onStatusFilter,
  onConnectClick,
}: QueueSidebarProps) {
  return (
    <aside className="hidden lg:block w-[272px] bg-gradient-to-b from-[#0a1628] to-[#0f1d33] h-full overflow-y-auto">
      <div className="p-6 space-y-8">
        {/* Logo */}
        <div className="flex items-center gap-0.5">
          <span className="font-black text-2xl text-white tracking-tight">N</span>
          <span className="font-black text-2xl text-red-500 tracking-tight">R</span>
        </div>

        {/* Overview Stats */}
        <div>
          <h2 className="font-mono uppercase text-[10px] text-white/50 tracking-wider mb-3">
            Overview
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-2.5">
              <div className="font-serif text-xl font-bold text-red-400">
                {stats.failed}
              </div>
              <div className="text-[11px] text-white/40 mt-0.5">Failed</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-2.5">
              <div className="font-serif text-xl font-bold text-amber-400">
                {stats.pending}
              </div>
              <div className="text-[11px] text-white/40 mt-0.5">Pending</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-2.5">
              <div className="font-serif text-xl font-bold text-blue-400">
                {stats.approved}
              </div>
              <div className="text-[11px] text-white/40 mt-0.5">Approved</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-2.5">
              <div className="font-serif text-xl font-bold text-emerald-400">
                {stats.sentLast24h}
              </div>
              <div className="text-[11px] text-white/40 mt-0.5">Sent 24h</div>
            </div>
          </div>
        </div>

        {/* Sites Filter */}
        <div>
          <h2 className="font-mono uppercase text-[10px] text-white/50 tracking-wider mb-3">
            Sites
          </h2>
          <div className="space-y-1">
            {/* All Sites */}
            <button
              onClick={() => onSiteFilter(null)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                siteFilter === null
                  ? 'bg-red-500/15 text-red-400'
                  : 'text-white/70 hover:bg-white/[0.03]'
              }`}
            >
              <div className="w-[22px] h-[22px] rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
                <HiOutlineGlobeAlt className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm flex-1 text-left">All Sites</span>
              <span className="font-mono text-[11px] bg-white/[0.08] px-2 py-0.5 rounded-full">
                {stats.sites.reduce((sum, site) => sum + site.postCount, 0)}
              </span>
            </button>

            {/* Individual Sites */}
            {stats.sites.map((site) => (
              <button
                key={site.id}
                onClick={() => onSiteFilter(site.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  siteFilter === site.id
                    ? 'bg-red-500/15 text-red-400'
                    : 'text-white/70 hover:bg-white/[0.03]'
                }`}
              >
                <div
                  className="w-[22px] h-[22px] rounded-md flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold"
                  style={{
                    backgroundColor: site.faviconColor || '#374151',
                  }}
                >
                  {getInitials(site.name)}
                </div>
                <span className="text-sm flex-1 text-left truncate">
                  {site.name}
                </span>
                <span className="font-mono text-[11px] bg-white/[0.08] px-2 py-0.5 rounded-full">
                  {site.postCount}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Platform Filter */}
        <div>
          <h2 className="font-mono uppercase text-[10px] text-white/50 tracking-wider mb-3">
            Platform
          </h2>
          <div className="flex flex-wrap gap-2">
            {/* All Platforms */}
            <button
              onClick={() => onPlatformFilter(null)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
                platformFilter === null
                  ? 'border-red-500/50 bg-red-500/15 text-red-400'
                  : 'border-white/10 text-white/70 hover:bg-white/[0.03]'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-white/40" />
              <span className="text-sm">All</span>
            </button>

            {/* Individual Platforms */}
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => onPlatformFilter(platform.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
                  platformFilter === platform.id
                    ? 'border-red-500/50 bg-red-500/15 text-red-400'
                    : 'border-white/10 text-white/70 hover:bg-white/[0.03]'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${platform.dotClass}`} />
                <span className="text-sm">{platform.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <h2 className="font-mono uppercase text-[10px] text-white/50 tracking-wider mb-3">
            Status
          </h2>
          <div className="space-y-1">
            {statuses.map((status) => (
              <button
                key={status.id || 'all'}
                onClick={() => onStatusFilter(status.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  statusFilter === status.id
                    ? 'bg-red-500/15 text-red-400 font-semibold'
                    : 'text-white/70 hover:bg-white/[0.03]'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${status.dotClass}`} />
                <span className="text-sm">{status.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Connect CTA */}
        <button
          onClick={onConnectClick}
          className="w-full border-2 border-dashed border-red-500/30 bg-red-500/[0.06] rounded-lg p-4 hover:bg-red-500/[0.09] transition-colors"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-xl font-bold">
              +
            </div>
            <div className="text-sm font-medium text-red-400">
              Connect Account
            </div>
            <div className="text-[11px] text-white/40">
              Add a social platform
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
}
