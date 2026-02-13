'use client';

import { useState, useCallback } from 'react';
import { HiOutlineMagnifyingGlass, HiOutlineMegaphone, HiOutlineChevronDown } from 'react-icons/hi2';
import type { DateFilter, AccountGroup, SocialPostData } from '@/types/social';
import AccountGroupCard from './AccountGroupCard';
import QueuePostRow from './QueuePostRow';

const POSTS_PER_PAGE = 3;

interface QueueViewProps {
  accountGroups: AccountGroup[];
  isLoading: boolean;
  // Search
  searchQuery: string;
  onSearchChange: (q: string) => void;
  // Date filter
  dateFilter: DateFilter;
  onDateFilterChange: (f: DateFilter) => void;
  // Batch
  selectedPostIds: Set<string>;
  onBatchApprove: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
  // Groups
  expandedGroups: Set<string>;
  onToggleGroup: (id: string) => void;
  onSelectAllInGroup: (id: string) => void;
  // Post actions
  onTogglePostSelection: (id: string) => void;
  onApprove: (id: string) => void;
  onSendNow: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveCaption: (id: string, caption: string) => void;
  onSaveSchedule: (id: string, schedule: string) => void;
  onRegenerate: (post: SocialPostData) => void;
  regeneratingCaption: string | null;
}

const dateFilterOptions: { value: DateFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'week', label: 'This Week' },
  { value: 'all', label: 'All' },
];

export default function QueueView({
  accountGroups,
  isLoading,
  searchQuery,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  selectedPostIds,
  onBatchApprove,
  onBatchDelete,
  onClearSelection,
  expandedGroups,
  onToggleGroup,
  onSelectAllInGroup,
  onTogglePostSelection,
  onApprove,
  onSendNow,
  onRetry,
  onDelete,
  onSaveCaption,
  onSaveSchedule,
  onRegenerate,
  regeneratingCaption,
}: QueueViewProps) {
  const hasBatchSelection = selectedPostIds.size > 0;

  // Track which groups have been expanded to show all posts
  const [showAllPosts, setShowAllPosts] = useState<Set<string>>(new Set());
  const toggleShowAll = useCallback((groupId: string) => {
    setShowAllPosts((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Filter Bar */}
      <div className="flex items-center gap-2.5 flex-wrap mb-4">
        {/* Search Box */}
        <div className="flex items-center gap-2 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-md px-3 py-2 max-w-[300px] flex-1 shadow-sm focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/10 transition">
          <HiOutlineMagnifyingGlass className="w-4 h-4 text-ink-400 dark:text-ink-500 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search posts..."
            className="flex-1 bg-transparent text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:outline-none"
          />
        </div>

        {/* Date Filter Chips */}
        {dateFilterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onDateFilterChange(option.value)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              dateFilter === option.value
                ? 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-semibold'
                : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'
            }`}
          >
            {option.label}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Batch Bar */}
        {hasBatchSelection && (
          <div className="flex items-center gap-3 px-4 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/50 rounded-lg">
            <span className="font-mono text-xs text-red-600 dark:text-red-400">
              {selectedPostIds.size} selected
            </span>
            <button
              onClick={onBatchApprove}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition"
            >
              Approve All
            </button>
            <button
              onClick={onBatchDelete}
              className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-md transition"
            >
              Delete
            </button>
            <button
              onClick={onClearSelection}
              className="px-3 py-1.5 text-xs font-medium text-ink-600 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200 transition"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-ink-400">Loading posts...</p>
          </div>
        ) : accountGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <HiOutlineMegaphone className="w-10 h-10 text-ink-200 dark:text-ink-700 mb-3" />
            <h3 className="font-display text-lg font-semibold text-ink-900 dark:text-ink-100 mb-1">
              No posts scheduled
            </h3>
            <p className="text-sm text-ink-500 dark:text-ink-400">
              Create a post to get started.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {accountGroups.map((group) => (
              <AccountGroupCard
                key={group.socialAccountId}
                group={group}
                isExpanded={expandedGroups.has(group.socialAccountId)}
                onToggle={() => onToggleGroup(group.socialAccountId)}
                selectedPostIds={selectedPostIds}
                onSelectAll={() => onSelectAllInGroup(group.socialAccountId)}
              >
                {/* Render posts in the group */}
                {(() => {
                  const isShowingAll = showAllPosts.has(group.socialAccountId);
                  const visiblePosts = isShowingAll ? group.posts : group.posts.slice(0, POSTS_PER_PAGE);
                  const hiddenCount = group.posts.length - POSTS_PER_PAGE;
                  return (
                    <div className="flex flex-col gap-1">
                      {visiblePosts.map((post) => (
                        <QueuePostRow
                          key={post.id}
                          post={post}
                          isSelected={selectedPostIds.has(post.id)}
                          onToggleSelect={() => onTogglePostSelection(post.id)}
                          onApprove={() => onApprove(post.id)}
                          onSendNow={() => onSendNow(post.id)}
                          onRetry={() => onRetry(post.id)}
                          onDelete={() => onDelete(post.id)}
                          onSaveCaption={(caption) => onSaveCaption(post.id, caption)}
                          onSaveSchedule={(schedule) => onSaveSchedule(post.id, schedule)}
                          onRegenerate={() => onRegenerate(post)}
                          isRegenerating={regeneratingCaption === post.id}
                        />
                      ))}
                      {hiddenCount > 0 && (
                        <button
                          onClick={() => toggleShowAll(group.socialAccountId)}
                          className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-ink-500 hover:text-red-600 dark:text-ink-400 dark:hover:text-red-400 transition-colors"
                        >
                          <HiOutlineChevronDown className={`w-3.5 h-3.5 transition-transform ${isShowingAll ? 'rotate-180' : ''}`} />
                          {isShowingAll ? 'Show less' : `Show ${hiddenCount} more`}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </AccountGroupCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
