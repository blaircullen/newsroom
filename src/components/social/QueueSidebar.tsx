'use client';

import { HiOutlineGlobeAlt, HiOutlinePlusCircle } from 'react-icons/hi2';
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
  { id: 'X', name: 'X', dotClass: 'bg-black dark:bg-white' },
  { id: 'FACEBOOK', name: 'Facebook', dotClass: 'bg-blue-500' },
  { id: 'INSTAGRAM', name: 'Instagram', dotClass: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500' },
  { id: 'TRUTHSOCIAL', name: 'Truth Social', dotClass: 'bg-indigo-600' },
];

const statuses: { id: PostStatus | null; name: string; dotClass: string }[] = [
  { id: null, name: 'All', dotClass: 'bg-ink-400' },
  { id: 'FAILED', name: 'Failed', dotClass: 'bg-red-500' },
  { id: 'PENDING', name: 'Pending', dotClass: 'bg-amber-500' },
  { id: 'APPROVED', name: 'Approved', dotClass: 'bg-blue-500' },
  { id: 'SENT', name: 'Sent', dotClass: 'bg-emerald-500' },
];

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.substring(0, 2).toUpperCase();
  return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
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
    <aside className="w-[260px] h-full overflow-y-auto border-r border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900">
      <div className="p-5 space-y-6">
        {/* Overview Stats */}
        <div>
          <h2 className="font-mono uppercase text-[10px] text-ink-400 tracking-wider mb-2.5">
            Overview
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-lg p-2.5">
              <div className="font-serif text-xl font-bold text-red-600 dark:text-red-400">
                {stats.failed}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">Failed</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-lg p-2.5">
              <div className="font-serif text-xl font-bold text-amber-600 dark:text-amber-400">
                {stats.pending}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">Pending</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-lg p-2.5">
              <div className="font-serif text-xl font-bold text-blue-600 dark:text-blue-400">
                {stats.approved}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">Approved</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg p-2.5">
              <div className="font-serif text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.sentLast24h}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">Sent 24h</div>
            </div>
          </div>
        </div>

        {/* Sites Filter */}
        <div>
          <h2 className="font-mono uppercase text-[10px] text-ink-400 tracking-wider mb-2.5">
            Sites
          </h2>
          <div className="space-y-0.5">
            <button
              onClick={() => onSiteFilter(null)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-sm ${
                siteFilter === null
                  ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-medium'
                  : 'text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              <div className="w-5 h-5 rounded bg-ink-100 dark:bg-ink-800 flex items-center justify-center flex-shrink-0">
                <HiOutlineGlobeAlt className="w-3 h-3 text-ink-500" />
              </div>
              <span className="flex-1 text-left">All Sites</span>
              <span className="font-mono text-[11px] text-ink-400">
                {stats.sites.reduce((sum, site) => sum + site.postCount, 0)}
              </span>
            </button>

            {stats.sites.map((site) => (
              <button
                key={site.id}
                onClick={() => onSiteFilter(site.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-sm ${
                  siteFilter === site.id
                    ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-medium'
                    : 'text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800'
                }`}
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-white text-[9px] font-bold"
                  style={{ backgroundColor: site.faviconColor || '#6b7280' }}
                >
                  {getInitials(site.name)}
                </div>
                <span className="flex-1 text-left truncate">{site.name}</span>
                <span className="font-mono text-[11px] text-ink-400">{site.postCount}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Platform Filter */}
        <div>
          <h2 className="font-mono uppercase text-[10px] text-ink-400 tracking-wider mb-2.5">
            Platform
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onPlatformFilter(null)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-sm transition-colors ${
                platformFilter === null
                  ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                  : 'border-ink-200 dark:border-ink-700 text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-ink-400" />
              All
            </button>

            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => onPlatformFilter(platform.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-sm transition-colors ${
                  platformFilter === platform.id
                    ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                    : 'border-ink-200 dark:border-ink-700 text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${platform.dotClass}`} />
                {platform.name}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <h2 className="font-mono uppercase text-[10px] text-ink-400 tracking-wider mb-2.5">
            Status
          </h2>
          <div className="space-y-0.5">
            {statuses.map((status) => (
              <button
                key={status.id || 'all'}
                onClick={() => onStatusFilter(status.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-sm ${
                  statusFilter === status.id
                    ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-medium'
                    : 'text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${status.dotClass}`} />
                {status.name}
              </button>
            ))}
          </div>
        </div>

        {/* Connect CTA */}
        <button
          onClick={onConnectClick}
          className="w-full border border-dashed border-red-300 dark:border-red-800 rounded-lg p-3 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center justify-center gap-2 text-red-500 text-sm font-medium"
        >
          <HiOutlinePlusCircle className="w-4 h-4" />
          Connect Account
        </button>
      </div>
    </aside>
  );
}
