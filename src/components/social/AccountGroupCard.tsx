'use client';

import { HiChevronRight } from 'react-icons/hi2';
import type { AccountGroup, PostStatus } from '@/types/social';
import AccountAvatar from './AccountAvatar';
import StatusBadge from './StatusBadge';

interface AccountGroupCardProps {
  group: AccountGroup;
  isExpanded: boolean;
  onToggle: () => void;
  selectedPostIds: Set<string>;
  onSelectAll: () => void;
  children: React.ReactNode;
}

export default function AccountGroupCard({
  group,
  isExpanded,
  onToggle,
  selectedPostIds,
  onSelectAll,
  children,
}: AccountGroupCardProps) {
  const statusCounts = group.posts.reduce((acc, post) => {
    acc[post.status] = (acc[post.status] || 0) + 1;
    return acc;
  }, {} as Record<PostStatus, number>);

  const containerClasses = group.urgency === 'FAILED'
    ? 'border-red-300/50 dark:border-red-800/50'
    : 'border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900';

  return (
    <div
      className={`rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition ${containerClasses}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ink-50/50 dark:hover:bg-ink-800/50 transition"
      >
        <AccountAvatar
          name={group.accountName}
          avatarUrl={group.avatarUrl}
          platform={group.platform}
          faviconColor={group.faviconColor}
        />

        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-sm text-ink-900 dark:text-ink-100 truncate">
              {group.accountName}
            </h3>
            {group.urgency === 'FAILED' && <StatusBadge status="FAILED" />}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {group.platform === 'FACEBOOK' ? (
              <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                Facebook Page
              </span>
            ) : (
              <span className="font-mono text-[11px] text-ink-500 dark:text-ink-400">
                {group.accountHandle}
              </span>
            )}
            {group.siteName && (
              <>
                <span className="text-ink-300 dark:text-ink-600">&bull;</span>
                <span className="text-[11px] text-ink-400 dark:text-ink-500 truncate">
                  {group.siteName}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Status Summary Badges */}
        <div className="flex items-center gap-1.5">
          {statusCounts.FAILED > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
              {statusCounts.FAILED}
            </span>
          )}
          {statusCounts.PENDING > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              {statusCounts.PENDING}
            </span>
          )}
          {statusCounts.APPROVED > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              {statusCounts.APPROVED}
            </span>
          )}
        </div>

        <div className="bg-ink-100 dark:bg-ink-800 px-2.5 py-1 rounded-full">
          <span className="text-xs font-mono text-ink-600 dark:text-ink-300">
            {group.posts.length} {group.posts.length === 1 ? 'post' : 'posts'}
          </span>
        </div>

        <HiChevronRight
          className={`w-5 h-5 text-ink-400 dark:text-ink-500 transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      {isExpanded && (
        <div className="px-2 pb-2">
          {children}
        </div>
      )}
    </div>
  );
}
