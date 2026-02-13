'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  HiOutlineCheck,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineClock,
  HiOutlineSparkles,
  HiOutlineArrowRight,
  HiOutlineArrowPath,
  HiOutlineArrowTopRightOnSquare,
} from 'react-icons/hi2';
import { etDatetimeLocalValue } from '@/lib/date-utils';
import type { SocialPostData } from '@/types/social';
import StatusBadge from './StatusBadge';

interface QueuePostRowProps {
  post: SocialPostData;
  isSelected: boolean;
  onToggleSelect: () => void;
  onApprove: () => void;
  onSendNow: () => void;
  onRetry: () => void;
  onDelete: () => void;
  onSaveCaption: (caption: string) => void;
  onSaveSchedule: (schedule: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

const ACTION_BTN = 'w-7 h-7 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 flex items-center justify-center text-ink-600 dark:text-ink-400 transition';

export default function QueuePostRow({
  post,
  isSelected,
  onToggleSelect,
  onApprove,
  onSendNow,
  onRetry,
  onDelete,
  onSaveCaption,
  onSaveSchedule,
  onRegenerate,
  isRegenerating,
}: QueuePostRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(post.caption);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const time = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    });
    const dateFormatted = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'America/New_York',
    });
    return { time, date: dateFormatted };
  };

  const scheduledTime = formatDateTime(post.scheduledAt);

  let rowClasses = 'group grid grid-cols-[20px_44px_1fr_auto_auto_auto] items-center gap-3 px-3 py-2.5 rounded-lg border transition';
  if (isSelected) {
    rowClasses += ' border-red-500 bg-red-50 dark:bg-red-950/20';
  } else if (post.status === 'FAILED') {
    rowClasses += ' border-l-[3px] border-l-red-500 bg-red-50 dark:bg-red-950/20 border-transparent';
  } else {
    rowClasses += ' border-transparent hover:bg-ink-50 dark:hover:bg-ink-800/50 hover:border-ink-200 dark:hover:border-ink-700';
  }

  const openEdit = () => { setExpanded(true); setEditingCaption(true); setCaptionDraft(post.caption); };

  return (
    <div className={rowClasses}>
      {/* Checkbox */}
      <div
        onClick={onToggleSelect}
        className="w-4 h-4 border-2 rounded cursor-pointer flex items-center justify-center transition"
        style={{
          borderColor: isSelected ? '#DC2626' : '#D1D5DB',
          backgroundColor: isSelected ? '#DC2626' : 'transparent',
        }}
      >
        {isSelected && <HiOutlineCheck className="w-3 h-3 text-white" strokeWidth={3} />}
      </div>

      {/* Thumbnail */}
      <div className="w-11 h-11 rounded-md overflow-hidden bg-ink-100 dark:bg-ink-800 flex-shrink-0">
        {(post.imageUrl || post.article.featuredImage) ? (
          <Image
            src={post.imageUrl || post.article.featuredImage || ''}
            alt=""
            width={44}
            height={44}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-800 dark:text-ink-200 truncate max-w-[480px]">{post.caption}</p>
        {post.status === 'FAILED' && post.errorMessage ? (
          <p className="text-[11px] text-red-600 dark:text-red-400 truncate mt-0.5">{post.errorMessage}</p>
        ) : (
          <p className="text-[11px] text-ink-400 dark:text-ink-500 truncate mt-0.5">{post.articleUrl || post.article.headline}</p>
        )}
      </div>

      {/* Time */}
      <div className="font-mono text-[11px] text-right flex-shrink-0">
        <div className="text-ink-600 dark:text-ink-300">{scheduledTime.time}</div>
        <div className="text-[10px] text-ink-400 dark:text-ink-500 mt-0.5">{scheduledTime.date}</div>
      </div>

      {/* Status Badge */}
      <div className="flex-shrink-0 min-w-[80px] flex justify-center">
        <StatusBadge status={post.status} size="md" />
      </div>

      {/* Hover Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {post.status === 'PENDING' && (
          <>
            <button onClick={onApprove} className={`${ACTION_BTN} hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/30 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400`} title="Approve">
              <HiOutlineCheck className="w-4 h-4" />
            </button>
            <button onClick={openEdit} className={`${ACTION_BTN} hover:bg-ink-50 dark:hover:bg-ink-700`} title="Edit Caption">
              <HiOutlinePencil className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className={`${ACTION_BTN} hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950/30 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400`} title="Delete">
              <HiOutlineTrash className="w-4 h-4" />
            </button>
          </>
        )}

        {post.status === 'APPROVED' && (
          <>
            <button onClick={onSendNow} className={`${ACTION_BTN} hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-950/30 dark:hover:border-emerald-700 hover:text-emerald-600 dark:hover:text-emerald-400`} title="Send Now">
              <HiOutlineArrowRight className="w-4 h-4" />
            </button>
            <button onClick={openEdit} className={`${ACTION_BTN} hover:bg-ink-50 dark:hover:bg-ink-700`} title="Edit Caption">
              <HiOutlinePencil className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className={`${ACTION_BTN} hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950/30 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400`} title="Delete">
              <HiOutlineTrash className="w-4 h-4" />
            </button>
          </>
        )}

        {post.status === 'FAILED' && (
          <>
            <button onClick={onRetry} className={`${ACTION_BTN} hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/30 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400`} title="Retry">
              <HiOutlineArrowPath className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className={`${ACTION_BTN} hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950/30 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400`} title="Delete">
              <HiOutlineTrash className="w-4 h-4" />
            </button>
          </>
        )}

        {post.status === 'SENDING' && (
          <span className="text-[11px] text-ink-400 dark:text-ink-500 font-mono px-2">Sending...</span>
        )}

        {post.status === 'SENT' && post.platformPostId && (
          <button
            onClick={() => { const url = getPlatformUrl(post); if (url) window.open(url, '_blank'); }}
            className={`${ACTION_BTN} hover:bg-ink-50 dark:hover:bg-ink-700`}
            title="View on Platform"
          >
            <HiOutlineArrowTopRightOnSquare className="w-4 h-4" />
          </button>
        )}

        {post.status !== 'SENT' && post.status !== 'SENDING' && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className={`${ACTION_BTN} hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950/30 dark:hover:border-purple-700 hover:text-purple-600 dark:hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Regenerate Caption"
          >
            <HiOutlineSparkles className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
          </button>
        )}

        {post.status !== 'SENT' && (
          <button
            onClick={() => { setExpanded(true); setEditingSchedule(true); }}
            className={`${ACTION_BTN} hover:bg-ink-50 dark:hover:bg-ink-700`}
            title="Edit Schedule"
          >
            <HiOutlineClock className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expanded inline editing */}
      {expanded && (
        <div className="col-span-full px-3 pb-3 border-t border-ink-100 dark:border-ink-800 mt-1 pt-2">
          {editingCaption && (
            <div className="mb-2">
              <textarea
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setEditingCaption(false); setCaptionDraft(post.caption); }
                  if (e.key === 'Enter' && e.metaKey) { onSaveCaption(captionDraft); setEditingCaption(false); }
                }}
                className="w-full px-3 py-2 rounded-lg border border-ink-300 dark:border-ink-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 text-sm focus:outline-none bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100"
                rows={3}
                autoFocus
              />
              <div className="flex items-center gap-2 mt-1">
                <button type="button" onClick={() => { onSaveCaption(captionDraft); setEditingCaption(false); }} className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Save</button>
                <button type="button" onClick={() => { setEditingCaption(false); setCaptionDraft(post.caption); }} className="px-2.5 py-1 text-xs font-medium text-ink-500 hover:text-ink-700">Cancel</button>
              </div>
            </div>
          )}
          {editingSchedule && (
            <div className="mb-2">
              <input
                type="datetime-local"
                defaultValue={etDatetimeLocalValue(new Date(post.scheduledAt))}
                onBlur={(e) => { onSaveSchedule(new Date(e.target.value).toISOString()); setEditingSchedule(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingSchedule(false);
                  if (e.key === 'Enter') { onSaveSchedule(new Date(e.currentTarget.value).toISOString()); setEditingSchedule(false); }
                }}
                className="px-3 py-1.5 rounded-lg border border-ink-300 dark:border-ink-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 text-xs focus:outline-none bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100"
                autoFocus
              />
            </div>
          )}
          {!editingCaption && !editingSchedule && (
            <button type="button" onClick={() => setExpanded(false)} className="text-xs text-ink-400 hover:text-ink-600">Collapse</button>
          )}
        </div>
      )}
    </div>
  );
}

function getPlatformUrl(post: SocialPostData): string | null {
  if (!post.platformPostId) return null;
  const { platform, accountHandle: handle } = post.socialAccount;
  switch (platform) {
    case 'X': return `https://twitter.com/${handle}/status/${post.platformPostId}`;
    case 'FACEBOOK': return `https://facebook.com/${post.platformPostId}`;
    case 'TRUTHSOCIAL': return `https://truthsocial.com/${handle}/posts/${post.platformPostId}`;
    case 'INSTAGRAM': return `https://instagram.com/p/${post.platformPostId}`;
    default: return null;
  }
}
