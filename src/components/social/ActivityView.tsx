'use client';

import { useMemo } from 'react';
import { HiOutlineClock } from 'react-icons/hi2';
import type { SocialPostData } from '@/types/social';

interface ActivityViewProps {
  posts: SocialPostData[];
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  });
}

function getPlatformName(platform: string): string {
  switch (platform) {
    case 'X':
      return 'X';
    case 'FACEBOOK':
      return 'Facebook';
    case 'TRUTHSOCIAL':
      return 'Truth Social';
    case 'INSTAGRAM':
      return 'Instagram';
    default:
      return platform;
  }
}

export default function ActivityView({ posts }: ActivityViewProps) {
  const activityItems = useMemo(() => {
    // Filter to SENT and FAILED, sort by most recent
    const filtered = posts.filter((p) => p.status === 'SENT' || p.status === 'FAILED');

    filtered.sort((a, b) => {
      const aTime = a.sentAt || a.updatedAt;
      const bTime = b.sentAt || b.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    return filtered.slice(0, 50);
  }, [posts]);

  if (activityItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <HiOutlineClock className="w-10 h-10 text-ink-200 dark:text-ink-700 mb-3" />
        <h3 className="font-display text-lg font-semibold text-ink-900 dark:text-ink-100 mb-1">
          No recent activity
        </h3>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Activity will appear here once posts are sent or fail.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Timeline Line */}
      <div className="absolute left-[8px] top-0 bottom-0 w-0.5 bg-ink-200 dark:bg-ink-700" />

      {/* Activity Items */}
      <div className="space-y-2">
        {activityItems.map((post) => {
          const isSent = post.status === 'SENT';
          const isFailed = post.status === 'FAILED';
          const timestamp = post.sentAt || post.updatedAt;
          const captionPreview = post.caption.length > 60 ? `${post.caption.slice(0, 60)}...` : post.caption;

          return (
            <div key={post.id} className="relative">
              {/* Status Dot */}
              <div
                className={`absolute left-[-20px] top-3 w-2.5 h-2.5 rounded-full ${
                  isSent ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />

              {/* Activity Card */}
              <div className="bg-white dark:bg-ink-900 rounded-lg border border-ink-100 dark:border-ink-800 shadow-sm px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  {isSent ? (
                    <p className="text-sm text-ink-700 dark:text-ink-300">
                      <span className="font-semibold text-ink-900 dark:text-ink-100">
                        {post.socialAccount.accountHandle}
                      </span>
                      {' '}posted "{captionPreview}" to{' '}
                      <span className="font-medium">{getPlatformName(post.socialAccount.platform)}</span>
                    </p>
                  ) : (
                    <div>
                      <p className="text-sm text-ink-700 dark:text-ink-300">
                        <span className="font-semibold text-ink-900 dark:text-ink-100">
                          {post.socialAccount.accountHandle}
                        </span>
                        {' '}
                        <span className="text-red-500 dark:text-red-400 font-medium">failed</span>
                      </p>
                      {post.errorMessage && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-1 line-clamp-1">
                          {post.errorMessage}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <span className="font-mono text-[11px] text-ink-400 dark:text-ink-500 whitespace-nowrap">
                  {formatTimeAgo(timestamp)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
