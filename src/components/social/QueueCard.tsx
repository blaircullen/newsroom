'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineTrash,
  HiOutlineArrowPath,
  HiOutlineSparkles,
  HiOutlinePencilSquare,
  HiOutlineArrowTopRightOnSquare,
} from 'react-icons/hi2';
import { FaXTwitter, FaFacebook } from 'react-icons/fa6';
import { etDatetimeLocalValue } from '@/lib/date-utils';

interface SocialPost {
  id: string;
  articleId: string;
  socialAccountId: string;
  caption: string;
  imageUrl: string | null;
  articleUrl: string;
  scheduledAt: string;
  sentAt: string | null;
  platformPostId: string | null;
  status: 'PENDING' | 'APPROVED' | 'SENDING' | 'SENT' | 'FAILED';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  article: {
    headline: string;
    featuredImage: string | null;
  };
  socialAccount: {
    platform: 'X' | 'FACEBOOK' | 'TRUTH_SOCIAL' | 'INSTAGRAM';
    accountName: string;
    accountHandle: string;
    publishTargetId: string | null;
  };
}

interface QueueCardProps {
  post: SocialPost;
  variant: 'scheduled' | 'posted';
  onApprove?: (id: string) => void;
  onSendNow?: (id: string) => void;
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSaveCaption?: (id: string, caption: string) => void;
  onSaveSchedule?: (id: string, schedule: string) => void;
  onRegenerate?: (post: SocialPost) => void;
  isRegenerating?: boolean;
}

function getPlatformIcon(platform: string) {
  switch (platform) {
    case 'X':
      return <FaXTwitter className="w-3.5 h-3.5" />;
    case 'FACEBOOK':
      return <FaFacebook className="w-3.5 h-3.5" />;
    default:
      return null;
  }
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getViewUrl(post: SocialPost): string | null {
  if (post.status !== 'SENT' || !post.platformPostId) return null;
  if (post.socialAccount.platform === 'X') {
    return `https://x.com/${post.socialAccount.accountHandle.replace('@', '')}/status/${post.platformPostId}`;
  }
  return null;
}

export default function QueueCard({
  post,
  variant,
  onApprove,
  onSendNow,
  onRetry,
  onDelete,
  onSaveCaption,
  onSaveSchedule,
  onRegenerate,
  isRegenerating,
}: QueueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(post.caption);

  const isFailed = post.status === 'FAILED';
  const isPosted = variant === 'posted';
  const isEditable = ['PENDING', 'APPROVED', 'FAILED'].includes(post.status);
  const thumbnail = post.imageUrl || post.article.featuredImage;
  const viewUrl = getViewUrl(post);

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isFailed
          ? 'border-l-4 border-l-red-500 border-t-ink-100 border-r-ink-100 border-b-ink-100 dark:border-t-ink-700 dark:border-r-ink-700 dark:border-b-ink-700'
          : isPosted
            ? 'border-ink-700/30'
            : 'border-ink-100 dark:border-ink-800'
      } ${
        isPosted
          ? 'bg-ink-800/50'
          : 'bg-white dark:bg-ink-900'
      }`}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2.5 flex items-center gap-3"
      >
        {/* Thumbnail */}
        {thumbnail ? (
          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-ink-100 dark:bg-ink-800">
            <Image
              src={thumbnail}
              alt=""
              width={48}
              height={48}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-lg flex-shrink-0 bg-ink-100 dark:bg-ink-800" />
        )}

        {/* Caption + URL */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm line-clamp-2 ${
            isPosted ? 'text-ink-200' : 'text-ink-800 dark:text-ink-200'
          }`}>
            {post.caption}
          </p>
          <p className={`text-xs truncate mt-0.5 ${
            isPosted ? 'text-ink-400' : 'text-ink-400'
          }`}>
            {post.articleUrl}
          </p>
        </div>

        {/* Platform icon + handle + timestamp */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`w-6 h-6 rounded flex items-center justify-center text-white ${
            post.socialAccount.platform === 'FACEBOOK' ? 'bg-blue-600' : 'bg-black'
          }`}>
            {getPlatformIcon(post.socialAccount.platform)}
          </div>
          <div className="flex flex-col items-end">
            <span className={`text-xs font-medium whitespace-nowrap ${
              isPosted ? 'text-ink-300' : 'text-ink-700 dark:text-ink-300'
            }`}>
              {post.socialAccount.accountHandle}
            </span>
            <span className={`text-[11px] whitespace-nowrap ${
              isPosted ? 'text-ink-500' : 'text-ink-400'
            }`}>
              {isPosted && post.sentAt
                ? formatDateTime(post.sentAt)
                : formatDateTime(post.scheduledAt)}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded section */}
      {expanded && (
        <div className={`px-3 pb-3 border-t ${
          isPosted ? 'border-ink-700/30' : 'border-ink-100 dark:border-ink-800'
        }`}>
          {/* Error message for failed posts */}
          {isFailed && post.errorMessage && (
            <div className="mt-2 text-xs text-red-400 bg-red-950/30 rounded-lg p-2">
              {post.errorMessage}
            </div>
          )}

          {/* Caption editing */}
          {editingCaption && isEditable ? (
            <div className="mt-2">
              <textarea
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setEditingCaption(false);
                    setCaptionDraft(post.caption);
                  }
                  if (e.key === 'Enter' && e.metaKey) {
                    onSaveCaption?.(post.id, captionDraft);
                    setEditingCaption(false);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-press-500 text-sm focus:outline-none bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100"
                rows={3}
                autoFocus
              />
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    onSaveCaption?.(post.id, captionDraft);
                    setEditingCaption(false);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-white bg-press-600 rounded-lg hover:bg-press-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCaption(false);
                    setCaptionDraft(post.caption);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-ink-500 hover:text-ink-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {/* Schedule editing */}
          {editingSchedule && isEditable ? (
            <div className="mt-2">
              <input
                type="datetime-local"
                defaultValue={etDatetimeLocalValue(new Date(post.scheduledAt))}
                onBlur={(e) => {
                  onSaveSchedule?.(post.id, new Date(e.target.value).toISOString());
                  setEditingSchedule(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingSchedule(false);
                  if (e.key === 'Enter') {
                    onSaveSchedule?.(post.id, new Date(e.currentTarget.value).toISOString());
                    setEditingSchedule(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-press-500 text-xs focus:outline-none bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100"
                autoFocus
              />
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {post.status === 'PENDING' && (
              <button
                type="button"
                onClick={() => onApprove?.(post.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              >
                <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                Approve
              </button>
            )}

            {post.status === 'APPROVED' && (
              <button
                type="button"
                onClick={() => onSendNow?.(post.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
              >
                Send Now
              </button>
            )}

            {post.status === 'FAILED' && (
              <button
                type="button"
                onClick={() => onRetry?.(post.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-colors"
              >
                <HiOutlineArrowPath className="w-3.5 h-3.5" />
                Retry
              </button>
            )}

            {isEditable && !editingCaption && (
              <button
                type="button"
                onClick={() => setEditingCaption(true)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isPosted
                    ? 'text-ink-400 hover:text-ink-200'
                    : 'text-ink-500 hover:text-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800'
                }`}
              >
                <HiOutlinePencilSquare className="w-3.5 h-3.5" />
                Edit Caption
              </button>
            )}

            {isEditable && (
              <button
                type="button"
                onClick={() => onRegenerate?.(post)}
                disabled={isRegenerating}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                  isPosted
                    ? 'text-press-400 hover:text-press-300'
                    : 'text-press-600 dark:text-press-400 hover:bg-press-50 dark:hover:bg-press-900/30'
                }`}
              >
                <HiOutlineSparkles className="w-3.5 h-3.5" />
                {isRegenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            )}

            {isEditable && !editingSchedule && (
              <button
                type="button"
                onClick={() => setEditingSchedule(true)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isPosted
                    ? 'text-ink-400 hover:text-ink-200'
                    : 'text-ink-500 hover:text-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800'
                }`}
              >
                <HiOutlineClock className="w-3.5 h-3.5" />
                Edit Schedule
              </button>
            )}

            {isEditable && (
              <button
                type="button"
                onClick={() => onDelete?.(post.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <HiOutlineTrash className="w-3.5 h-3.5" />
                Delete
              </button>
            )}

            {viewUrl && (
              <a
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-press-500 hover:text-press-400 rounded-lg transition-colors"
              >
                <HiOutlineArrowTopRightOnSquare className="w-3.5 h-3.5" />
                View on Platform
              </a>
            )}

            {post.status === 'SENDING' && (
              <span className="text-xs text-purple-500 animate-pulse px-2.5 py-1.5">
                Sending...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
