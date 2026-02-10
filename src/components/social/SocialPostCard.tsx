'use client';

import Image from 'next/image';
import { FaXTwitter, FaFacebook } from 'react-icons/fa6';
import { HiOutlineSparkles, HiOutlineTrash } from 'react-icons/hi2';
import TimeSuggestions from './TimeSuggestions';
import type { PostingProfile } from '@/lib/optimal-timing';

interface AvailableUrl {
  name: string;
  url: string;
}

interface SocialPostCardProps {
  account: {
    id: string;
    platform: string;
    accountName: string;
    accountHandle: string;
  };
  caption: string;
  onCaptionChange: (caption: string) => void;
  scheduledAt: string;
  onScheduledAtChange: (time: string) => void;
  imageUrl?: string;
  articleUrl: string;
  availableUrls?: AvailableUrl[];
  onArticleUrlChange?: (url: string) => void;
  isGenerating: boolean;
  onRegenerate: () => void;
  onRemove: () => void;
  postingProfile?: PostingProfile | null;
}

export default function SocialPostCard({
  account,
  caption,
  onCaptionChange,
  scheduledAt,
  onScheduledAtChange,
  imageUrl,
  articleUrl,
  availableUrls,
  onArticleUrlChange,
  isGenerating,
  onRegenerate,
  onRemove,
  postingProfile,
}: SocialPostCardProps) {
  const isX = account.platform === 'X';
  const isFacebook = account.platform === 'FACEBOOK';

  // Character limit for X platform
  const characterLimit = isX ? 280 : 63206; // Facebook has ~63K character limit
  const isOverLimit = caption.length > characterLimit;

  // Platform-specific styling
  const platformColor = isX
    ? 'bg-black text-white'
    : isFacebook
    ? 'bg-blue-600 text-white'
    : 'bg-ink-600 text-white';

  const PlatformIcon = isX ? FaXTwitter : isFacebook ? FaFacebook : null;

  return (
    <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-4">
      {/* Header: Platform + Handle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${platformColor} flex items-center justify-center`}>
            {PlatformIcon && <PlatformIcon className="w-4 h-4" />}
          </div>
          <div>
            <p className="font-medium text-ink-900 dark:text-ink-100 text-sm">
              {account.accountName}
            </p>
            {account.platform !== 'FACEBOOK' && (
              <p className="text-ink-400 text-xs">@{account.accountHandle}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-2 text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Remove this post"
        >
          <HiOutlineTrash className="w-4 h-4" />
        </button>
      </div>

      {/* Caption textarea */}
      <div className="mb-3">
        <textarea
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          disabled={isGenerating}
          rows={4}
          className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-lg text-sm bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-press-500/20 focus:border-press-500 resize-none disabled:opacity-50"
          placeholder={isGenerating ? 'Generating caption...' : 'Enter caption...'}
        />
        <div className="flex items-center justify-between mt-1">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-press-600 dark:text-press-400 hover:text-press-700 dark:hover:text-press-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <HiOutlineSparkles className="w-3.5 h-3.5" />
            {isGenerating ? 'Generating...' : 'Regenerate'}
          </button>
          <p
            className={`text-xs ${
              isOverLimit ? 'text-red-500 font-medium' : 'text-ink-400'
            }`}
          >
            {caption.length} / {characterLimit}
          </p>
        </div>
      </div>

      {/* Featured image thumbnail */}
      {imageUrl && (
        <div className="mb-3 relative w-full h-32">
          <Image
            src={imageUrl}
            alt="Featured image"
            fill
            className="object-cover rounded-lg border border-ink-100 dark:border-ink-700"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        </div>
      )}

      {/* Article URL preview / selector */}
      <div className="mb-3 p-2 bg-ink-50 dark:bg-ink-800/50 rounded-lg">
        <p className="text-xs text-ink-400 mb-1">Article URL</p>
        {availableUrls && availableUrls.length > 1 && onArticleUrlChange ? (
          <select
            value={articleUrl}
            onChange={(e) => onArticleUrlChange(e.target.value)}
            className="w-full px-2 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md text-xs bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-press-500/20 focus:border-press-500"
          >
            {availableUrls.map((u) => (
              <option key={u.url} value={u.url}>
                {u.name} — {u.url}
              </option>
            ))}
          </select>
        ) : (
          <a
            href={articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-press-600 dark:text-press-400 hover:underline truncate block"
          >
            {articleUrl}
          </a>
        )}
      </div>

      {/* Time suggestions + Scheduled time */}
      <div>
        {postingProfile && (
          <TimeSuggestions
            profile={postingProfile}
            onSelectTime={onScheduledAtChange}
            selectedTime={scheduledAt}
          />
        )}
        <label className="block text-xs font-medium text-ink-500 dark:text-ink-400 mb-1">
          {postingProfile ? 'Or pick a custom time' : 'Scheduled for'}
        </label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => onScheduledAtChange(e.target.value)}
          className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-lg text-sm bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-press-500/20 focus:border-press-500"
        />
      </div>
    </div>
  );
}
