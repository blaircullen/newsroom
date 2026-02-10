'use client';

import { ReactNode } from 'react';
import { HiChevronRight } from 'react-icons/hi2';
import { FaXTwitter, FaFacebook } from 'react-icons/fa6';

interface PersonGroupCardProps {
  accountName: string;
  platforms: Set<string>;
  postCount: number;
  urgency: 'FAILED' | 'PENDING' | 'APPROVED' | 'SENT';
  isExpanded: boolean;
  onToggle: () => void;
  variant: 'scheduled' | 'posted';
  children: ReactNode;
}

const urgencyDot: Record<string, string> = {
  FAILED: 'bg-red-500 animate-pulse',
  PENDING: 'bg-yellow-500',
  APPROVED: 'bg-emerald-500',
  SENT: 'bg-emerald-500',
};

function PlatformBadge({ platform }: { platform: string }) {
  switch (platform) {
    case 'X':
      return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-black text-white">
          <FaXTwitter className="w-3 h-3" />
        </span>
      );
    case 'FACEBOOK':
      return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-600 text-white">
          <FaFacebook className="w-3 h-3" />
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-ink-500 text-white text-[10px] font-bold">
          {platform[0]}
        </span>
      );
  }
}

export default function PersonGroupCard({
  accountName,
  platforms,
  postCount,
  urgency,
  isExpanded,
  onToggle,
  variant,
  children,
}: PersonGroupCardProps) {
  const isPosted = variant === 'posted';

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        urgency === 'FAILED' && !isPosted
          ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
          : isPosted
            ? 'border-ink-700/30 bg-ink-800/30'
            : 'border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900'
      }`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full min-h-[48px] px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
          isPosted
            ? 'hover:bg-ink-700/30'
            : 'hover:bg-ink-50 dark:hover:bg-ink-800/50'
        }`}
      >
        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${urgencyDot[urgency] || 'bg-ink-400'}`} />

        {/* Person name */}
        <span
          className={`font-display font-semibold text-sm truncate ${
            isPosted ? 'text-ink-200' : 'text-ink-800 dark:text-ink-200'
          }`}
        >
          {accountName}
        </span>

        {/* Failed badge */}
        {urgency === 'FAILED' && !isPosted && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded flex-shrink-0">
            Failed
          </span>
        )}

        {/* Platform badges */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {Array.from(platforms).map((p) => (
            <PlatformBadge key={p} platform={p} />
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Post count badge */}
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            urgency === 'FAILED' && !isPosted
              ? 'bg-red-500 text-white'
              : isPosted
                ? 'bg-ink-700 text-ink-300'
                : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400'
          }`}
        >
          {postCount}
        </span>

        {/* Chevron */}
        <HiChevronRight
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          } ${isPosted ? 'text-ink-500' : 'text-ink-400'}`}
        />
      </button>

      {/* Children */}
      {isExpanded && (
        <div className="px-2 pb-2 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}
