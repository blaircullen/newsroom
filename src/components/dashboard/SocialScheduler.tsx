'use client';

import SocialPostCard from '@/components/social/SocialPostCard';
import type { PostingProfile } from '@/lib/optimal-timing';

interface SocialAccount {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string;
  publishTargetId: string | null;
  isActive: boolean;
  optimalHours: PostingProfile | null;
}

interface SocialPostDraft {
  accountId: string;
  caption: string;
  scheduledAt: string;
  articleUrl: string;
  isGenerating: boolean;
}

interface AvailableUrl {
  name: string;
  url: string;
}

interface SocialSchedulerProps {
  isLoadingSocial: boolean;
  socialAccounts: SocialAccount[];
  socialPostDrafts: Map<string, SocialPostDraft>;
  availableUrls: AvailableUrl[];
  onCaptionChange: (accountId: string, caption: string) => void;
  onScheduledAtChange: (accountId: string, scheduledAt: string) => void;
  onArticleUrlChange: (accountId: string, articleUrl: string) => void;
  onRegenerate: (accountId: string) => void;
  onRemove: (accountId: string) => void;
  onAddAccount: (accountId: string) => void;
}

export default function SocialScheduler({
  isLoadingSocial,
  socialAccounts,
  socialPostDrafts,
  availableUrls,
  onCaptionChange,
  onScheduledAtChange,
  onArticleUrlChange,
  onRegenerate,
  onRemove,
  onAddAccount,
}: SocialSchedulerProps) {
  if (isLoadingSocial) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin w-6 h-6 border-2 border-ink-200 border-t-press-500 rounded-full mx-auto" />
        <p className="text-ink-400 text-sm mt-3">Loading social accounts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Posts being drafted */}
      {Array.from(socialPostDrafts.entries()).map(([accountId, draft]) => {
        const account = socialAccounts.find((acc) => acc.id === accountId);
        if (!account) return null;

        return (
          <SocialPostCard
            key={accountId}
            account={account}
            caption={draft.caption}
            onCaptionChange={(caption) => onCaptionChange(accountId, caption)}
            scheduledAt={draft.scheduledAt}
            onScheduledAtChange={(time) => onScheduledAtChange(accountId, time)}
            imageUrl={undefined}
            articleUrl={draft.articleUrl}
            availableUrls={availableUrls}
            onArticleUrlChange={(url) => onArticleUrlChange(accountId, url)}
            isGenerating={draft.isGenerating}
            onRegenerate={() => onRegenerate(accountId)}
            onRemove={() => onRemove(accountId)}
            postingProfile={account.optimalHours}
          />
        );
      })}

      {/* Add account dropdown */}
      {socialAccounts.length > socialPostDrafts.size && (
        <div>
          <label className="block text-xs font-medium text-ink-500 dark:text-ink-400 mb-2">
            Add another account
          </label>
          <select
            onChange={(e) => {
              if (e.target.value) {
                onAddAccount(e.target.value);
                e.target.value = '';
              }
            }}
            className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-lg text-sm bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-press-500/20 focus:border-press-500"
          >
            <option value="">Select an account...</option>
            {socialAccounts
              .filter((acc) => !socialPostDrafts.has(acc.id))
              .map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.platform} - {acc.accountName}
                </option>
              ))}
          </select>
        </div>
      )}

      {socialPostDrafts.size === 0 && (
        <div className="py-8 text-center">
          <p className="text-ink-400 text-sm">No social accounts linked to published sites.</p>
          <p className="text-ink-300 text-xs mt-1">Add accounts using the dropdown above.</p>
        </div>
      )}
    </div>
  );
}
