'use client';

import { useState, useEffect } from 'react';
import {
  HiOutlineGlobeAlt,
  HiOutlineXMark,
  HiOutlineCheck,
  HiOutlineExclamationTriangle,
  HiOutlineClock,
  HiOutlineCalendarDays,
  HiOutlineShare,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import SocialPostCard from '@/components/social/SocialPostCard';
import type { PostingProfile } from '@/lib/optimal-timing';

interface PublishTarget {
  id: string;
  name: string;
  type: string;
  url: string;
}

interface SiteResult {
  targetId: string;
  name: string;
  success: boolean;
  url?: string;
  error?: string;
}

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

interface PublishModalProps {
  articleId: string;
  onClose: () => void;
  onPublished: (url: string) => void;
}

export default function PublishModal({ articleId, onClose, onPublished }: PublishModalProps) {
  const [targets, setTargets] = useState<PublishTarget[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [results, setResults] = useState<SiteResult[] | null>(null);
  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Social post state
  const [step, setStep] = useState<'publish' | 'social'>('publish');
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [socialPostDrafts, setSocialPostDrafts] = useState<Map<string, SocialPostDraft>>(new Map());
  const [isLoadingSocial, setIsLoadingSocial] = useState(false);
  const [isQueuingPosts, setIsQueuingPosts] = useState(false);

  useEffect(() => {
    async function fetchTargets() {
      try {
        const res = await fetch('/api/articles/' + articleId + '/publish');
        const data = await res.json();
        setTargets(data.targets || []);
      } catch (error) {
        toast.error('Failed to load publish targets');
      } finally {
        setIsLoading(false);
      }
    }
    fetchTargets();
  }, [articleId]);

  const toggleTarget = (id: string) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedTargets.size === targets.length) setSelectedTargets(new Set());
    else setSelectedTargets(new Set(targets.map((t) => t.id)));
  };

  const handlePublish = async () => {
    if (selectedTargets.size === 0) {
      toast.error('Select at least one site');
      return;
    }
    if (publishMode === 'schedule' && (!scheduledDate || !scheduledTime)) {
      toast.error('Select a date and time for scheduling');
      return;
    }

    setIsPublishing(true);
    setResults(null);

    try {
      if (publishMode === 'schedule') {
        // Schedule the article with target site
        const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
        const targetId = Array.from(selectedTargets)[0]; // Use first selected target
        const res = await fetch('/api/articles/' + articleId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduledPublishAt: scheduledAt.toISOString(),
            scheduledPublishTargetId: targetId,
          }),
        });
        if (!res.ok) throw new Error('Failed to schedule article');
        const targetName = targets.find(t => t.id === targetId)?.name || 'selected site';
        toast.success(`Scheduled for ${scheduledAt.toLocaleString()} on ${targetName}`);
      } else {
        // Publish now
        const res = await fetch('/api/articles/' + articleId + '/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetIds: Array.from(selectedTargets) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to publish');
        setResults(data.results);
        const successes = data.results.filter((r: SiteResult) => r.success);
        const failures = data.results.filter((r: SiteResult) => !r.success);
        if (successes.length > 0 && failures.length === 0) {
          toast.success('Published to ' + successes.length + ' site' + (successes.length > 1 ? 's' : '') + '!');
          // Don't auto-close — let user continue to social posts or close manually
        } else if (successes.length > 0) {
          toast.success('Published to ' + successes.length + ', ' + failures.length + ' failed');
        } else {
          toast.error('All publish attempts failed');
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsPublishing(false);
    }
  };

  // Function to load social accounts and generate captions
  const handleContinueToSocial = async () => {
    setIsLoadingSocial(true);
    setStep('social');

    try {
      // Fetch all social accounts
      const res = await fetch('/api/social/accounts');
      if (!res.ok) throw new Error('Failed to load social accounts');
      const accounts: SocialAccount[] = await res.json();

      setSocialAccounts(accounts.filter(acc => acc.isActive));

      // Get successfully published target IDs and build URL lookup
      const successfulResults = results?.filter(r => r.success) || [];
      const successfulTargetIds = successfulResults.map(r => r.targetId);
      const targetIdToUrl = new Map(successfulResults.map(r => [r.targetId, r.url || '']));
      const defaultUrl = successfulResults[0]?.url || '';

      // Filter accounts linked to published sites
      const linkedAccounts = accounts.filter(
        acc => acc.isActive && acc.publishTargetId && successfulTargetIds.includes(acc.publishTargetId)
      );

      // Generate captions for linked accounts
      const draftsMap = new Map<string, SocialPostDraft>();

      for (const account of linkedAccounts) {
        // Default to the account's linked site URL, fall back to first successful
        const accountUrl = (account.publishTargetId && targetIdToUrl.get(account.publishTargetId)) || defaultUrl;

        // Set generating state
        draftsMap.set(account.id, {
          accountId: account.id,
          caption: '',
          scheduledAt: getSuggestedTime(),
          articleUrl: accountUrl,
          isGenerating: true,
        });
        setSocialPostDrafts(new Map(draftsMap));

        // Generate caption
        try {
          const captionRes = await fetch('/api/social/generate-caption', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articleId, socialAccountId: account.id }),
          });

          if (!captionRes.ok) throw new Error('Failed to generate caption');
          const { caption } = await captionRes.json();

          draftsMap.set(account.id, {
            accountId: account.id,
            caption,
            scheduledAt: getSuggestedTime(),
            articleUrl: accountUrl,
            isGenerating: false,
          });
          setSocialPostDrafts(new Map(draftsMap));
        } catch (error) {
          console.error('Caption generation error:', error);
          draftsMap.set(account.id, {
            accountId: account.id,
            caption: 'Failed to generate caption. Please edit manually.',
            scheduledAt: getSuggestedTime(),
            articleUrl: accountUrl,
            isGenerating: false,
          });
          setSocialPostDrafts(new Map(draftsMap));
        }
      }
    } catch (error) {
      toast.error('Failed to load social accounts');
      console.error('Social accounts error:', error);
    } finally {
      setIsLoadingSocial(false);
    }
  };

  // Get suggested post time (1 hour from now)
  const getSuggestedTime = () => {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    return date.toISOString().slice(0, 16);
  };

  // Handle caption change
  const handleCaptionChange = (accountId: string, caption: string) => {
    const draft = socialPostDrafts.get(accountId);
    if (draft) {
      setSocialPostDrafts(new Map(socialPostDrafts.set(accountId, { ...draft, caption })));
    }
  };

  // Handle scheduled time change
  const handleScheduledAtChange = (accountId: string, scheduledAt: string) => {
    const draft = socialPostDrafts.get(accountId);
    if (draft) {
      setSocialPostDrafts(new Map(socialPostDrafts.set(accountId, { ...draft, scheduledAt })));
    }
  };

  // Handle regenerate caption
  const handleRegenerateCaption = async (accountId: string) => {
    const draft = socialPostDrafts.get(accountId);
    if (!draft) return;

    setSocialPostDrafts(new Map(socialPostDrafts.set(accountId, { ...draft, isGenerating: true })));

    try {
      const res = await fetch('/api/social/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, socialAccountId: accountId }),
      });

      if (!res.ok) throw new Error('Failed to generate caption');
      const { caption } = await res.json();

      setSocialPostDrafts(new Map(socialPostDrafts.set(accountId, { ...draft, caption, isGenerating: false })));
    } catch (error) {
      toast.error('Failed to regenerate caption');
      setSocialPostDrafts(new Map(socialPostDrafts.set(accountId, { ...draft, isGenerating: false })));
    }
  };

  // Handle remove post
  const handleRemovePost = (accountId: string) => {
    const newDrafts = new Map(socialPostDrafts);
    newDrafts.delete(accountId);
    setSocialPostDrafts(newDrafts);
  };

  // Handle article URL change per account
  const handleArticleUrlChange = (accountId: string, articleUrl: string) => {
    const draft = socialPostDrafts.get(accountId);
    if (draft) {
      setSocialPostDrafts(new Map(socialPostDrafts.set(accountId, { ...draft, articleUrl })));
    }
  };

  // Handle add account
  const handleAddAccount = async (accountId: string) => {
    // Default URL: use account's linked site URL if available, otherwise first successful
    const account = socialAccounts.find(acc => acc.id === accountId);
    const successfulResults = results?.filter(r => r.success) || [];
    const targetIdToUrl = new Map(successfulResults.map(r => [r.targetId, r.url || '']));
    const defaultUrl = successfulResults[0]?.url || '';
    const accountUrl = (account?.publishTargetId && targetIdToUrl.get(account.publishTargetId)) || defaultUrl;

    // Set generating state
    const newDraft: SocialPostDraft = {
      accountId,
      caption: '',
      scheduledAt: getSuggestedTime(),
      articleUrl: accountUrl,
      isGenerating: true,
    };
    setSocialPostDrafts(new Map(socialPostDrafts.set(accountId, newDraft)));

    // Generate caption
    try {
      const res = await fetch('/api/social/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, socialAccountId: accountId }),
      });

      if (!res.ok) throw new Error('Failed to generate caption');
      const { caption } = await res.json();

      setSocialPostDrafts(new Map(socialPostDrafts.set(accountId, { ...newDraft, caption, isGenerating: false })));
    } catch (error) {
      toast.error('Failed to generate caption');
      setSocialPostDrafts(new Map(socialPostDrafts.set(accountId, { ...newDraft, isGenerating: false, caption: 'Failed to generate caption. Please edit manually.' })));
    }
  };

  // Build available URLs from successful publish results
  const availableUrls = (results?.filter(r => r.success && r.url) || []).map(r => ({
    name: r.name,
    url: r.url!,
  }));

  // Handle queue all posts
  const handleQueueAll = async () => {
    if (socialPostDrafts.size === 0) {
      toast.error('No posts to queue');
      return;
    }

    // Validate all posts
    const invalidPosts = Array.from(socialPostDrafts.values()).filter(
      draft => !draft.caption.trim() || !draft.scheduledAt
    );

    if (invalidPosts.length > 0) {
      toast.error('Please complete all captions and scheduled times');
      return;
    }

    setIsQueuingPosts(true);

    try {
      // Fetch article to get featured image
      const articleRes = await fetch(`/api/articles/${articleId}`);
      if (!articleRes.ok) throw new Error('Failed to fetch article');
      const article = await articleRes.json();

      // Build posts payload — each draft has its own articleUrl
      const posts = Array.from(socialPostDrafts.values()).map(draft => ({
        articleId,
        socialAccountId: draft.accountId,
        caption: draft.caption,
        imageUrl: article.featuredImage || undefined,
        articleUrl: draft.articleUrl,
        scheduledAt: new Date(draft.scheduledAt).toISOString(),
      }));

      const res = await fetch('/api/social/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts }),
      });

      if (!res.ok) throw new Error('Failed to queue posts');
      const data = await res.json();

      toast.success(`Queued ${data.count} social post${data.count > 1 ? 's' : ''}!`);
      onClose();
    } catch (error) {
      toast.error('Failed to queue social posts');
      console.error('Queue error:', error);
    } finally {
      setIsQueuingPosts(false);
    }
  };

  const allSelected = targets.length > 0 && selectedTargets.size === targets.length;
  const hasResults = results !== null;
  const hasSuccessfulPublish = results?.some(r => r.success) || false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/60 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-modal-title"
        className="relative bg-white dark:bg-ink-900 w-full max-w-md max-h-[90dvh] md:max-h-[85vh] overflow-hidden fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto rounded-t-2xl md:rounded-2xl shadow-elevated"
      >
        <div className="flex items-center justify-between px-4 md:px-5 py-5 border-b border-ink-100 dark:border-ink-800">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              step === 'social' ? 'bg-blue-50' : 'bg-emerald-50'
            }`}>
              {step === 'social' ? (
                <HiOutlineShare className="w-5 h-5 text-blue-600" />
              ) : (
                <HiOutlineGlobeAlt className="w-5 h-5 text-emerald-600" />
              )}
            </div>
            <div>
              <h3 id="publish-modal-title" className="font-display font-semibold text-lg text-ink-900 dark:text-ink-100">
                {step === 'social' ? 'Social Posts' : hasResults ? 'Publish Results' : 'Publish Article'}
              </h3>
              <p className="text-ink-400 text-xs">
                {step === 'social'
                  ? 'Review and schedule social media posts'
                  : hasResults
                  ? 'See status for each site below'
                  : 'Select one or more sites to publish to'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-press-500"
            aria-label="Close publish dialog"
          >
            <HiOutlineXMark className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 md:px-5 py-5 max-h-[60vh] overflow-y-auto">
          {step === 'social' ? (
            // Social posts step
            isLoadingSocial ? (
              <div className="py-8 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-ink-200 border-t-press-500 rounded-full mx-auto" />
                <p className="text-ink-400 text-sm mt-3">Loading social accounts...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Show posts being drafted */}
                {Array.from(socialPostDrafts.entries()).map(([accountId, draft]) => {
                  const account = socialAccounts.find(acc => acc.id === accountId);
                  if (!account) return null;

                  return (
                    <SocialPostCard
                      key={accountId}
                      account={account}
                      caption={draft.caption}
                      onCaptionChange={(caption) => handleCaptionChange(accountId, caption)}
                      scheduledAt={draft.scheduledAt}
                      onScheduledAtChange={(time) => handleScheduledAtChange(accountId, time)}
                      imageUrl={undefined} // Will be fetched when queueing
                      articleUrl={draft.articleUrl}
                      availableUrls={availableUrls}
                      onArticleUrlChange={(url) => handleArticleUrlChange(accountId, url)}
                      isGenerating={draft.isGenerating}
                      onRegenerate={() => handleRegenerateCaption(accountId)}
                      onRemove={() => handleRemovePost(accountId)}
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
                          handleAddAccount(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-lg text-sm bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-press-500/20 focus:border-press-500"
                    >
                      <option value="">Select an account...</option>
                      {socialAccounts
                        .filter(acc => !socialPostDrafts.has(acc.id))
                        .map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.platform} - @{acc.accountHandle}
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
            )
          ) : isLoading ? (
            <div className="py-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-ink-200 border-t-press-500 rounded-full mx-auto" />
            </div>
          ) : targets.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-ink-400 text-sm">No publish targets configured.</p>
              <p className="text-ink-300 text-xs mt-1">Add sites in Admin → Publish Sites</p>
            </div>
          ) : hasResults ? (
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.targetId}
                  className={'p-4 rounded-xl border-2 ' + (r.success ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50')}>
                  <div className="flex items-center gap-3">
                    {r.success ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <HiOutlineCheck className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                        <HiOutlineExclamationTriangle className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink-900 text-sm">{r.name}</p>
                      {r.success && r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-emerald-600 hover:underline truncate block">{r.url}</a>
                      ) : r.error ? (
                        <p className="text-xs text-red-600 truncate">{r.error}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Publish mode toggle */}
              <div className="flex items-center gap-2 p-1 bg-ink-100 dark:bg-ink-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPublishMode('now')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    publishMode === 'now'
                      ? 'bg-white dark:bg-ink-700 shadow-sm text-ink-900 dark:text-ink-100'
                      : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
                  }`}
                >
                  <HiOutlineGlobeAlt className="w-4 h-4" />
                  Publish Now
                </button>
                <button
                  type="button"
                  onClick={() => setPublishMode('schedule')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    publishMode === 'schedule'
                      ? 'bg-white dark:bg-ink-700 shadow-sm text-ink-900 dark:text-ink-100'
                      : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
                  }`}
                >
                  <HiOutlineClock className="w-4 h-4" />
                  Schedule
                </button>
              </div>

              {/* Schedule date/time picker (only in schedule mode) */}
              {publishMode === 'schedule' && (
                <div className="p-4 rounded-xl border-2 border-ink-100 dark:border-ink-700 bg-ink-50/50 dark:bg-ink-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <HiOutlineCalendarDays className="w-5 h-5 text-ink-500 dark:text-ink-400" />
                    <p className="font-medium text-ink-700 dark:text-ink-200 text-sm">Schedule for later</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-500 dark:text-ink-400 mb-1">Date</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-ink-200 dark:border-ink-600 rounded-lg text-sm bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-press-500/20 focus:border-press-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-500 dark:text-ink-400 mb-1">Time</label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full px-3 py-2 border border-ink-200 dark:border-ink-600 rounded-lg text-sm bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-press-500/20 focus:border-press-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Site selection (always shown) */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-ink-500 dark:text-ink-400">
                  {publishMode === 'schedule' ? 'Publish to' : 'Select sites'}
                </p>
                {targets.length > 1 && publishMode === 'now' && (
                  <button type="button" onClick={selectAll}
                    className="text-xs font-medium text-press-600 dark:text-press-400 hover:text-press-700 dark:hover:text-press-300 mb-1">
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </button>
                )}
                {targets.map((target) => {
                  const isSelected = selectedTargets.has(target.id);
                  return (
                    <button key={target.id} type="button" onClick={() => toggleTarget(target.id)}
                      className={'w-full text-left p-4 rounded-xl border-2 transition-all ' +
                        (isSelected ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-ink-100 dark:border-ink-700 hover:border-ink-200 dark:hover:border-ink-600')}>
                      <div className="flex items-center gap-3">
                        <div className={'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ' +
                          (isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800')}>
                          {isSelected && <HiOutlineCheck className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-ink-900 dark:text-ink-100">{target.name}</p>
                          <p className="text-xs text-ink-400 mt-0.5">{target.url}</p>
                        </div>
                        <span className={'text-xs px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ' +
                          (target.type === 'ghost' ? 'bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300' : 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300')}>
                          {target.type}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-5 border-t border-ink-100 dark:border-ink-800 bg-paper-50 dark:bg-ink-800/50">
          {step === 'social' ? (
            // Social step footer
            <>
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-ink-600 dark:text-ink-300 hover:text-ink-800 dark:hover:text-ink-100 transition-colors"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleQueueAll}
                disabled={socialPostDrafts.size === 0 || isQueuingPosts}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isQueuingPosts
                  ? 'Queueing...'
                  : `Queue ${socialPostDrafts.size} Post${socialPostDrafts.size !== 1 ? 's' : ''}`}
              </button>
            </>
          ) : (
            // Publish step footer
            <>
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-ink-600 dark:text-ink-300 hover:text-ink-800 dark:hover:text-ink-100 transition-colors"
              >
                {hasResults ? 'Close' : 'Cancel'}
              </button>
              <div className="flex items-center gap-3">
                {hasResults && hasSuccessfulPublish && (
                  <button
                    type="button"
                    onClick={handleContinueToSocial}
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all"
                  >
                    Continue to Social Posts
                  </button>
                )}
                {!hasResults && (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={selectedTargets.size === 0 || (publishMode === 'schedule' && (!scheduledDate || !scheduledTime)) || isPublishing}
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isPublishing
                      ? (publishMode === 'schedule' ? 'Scheduling...' : 'Publishing...')
                      : publishMode === 'schedule'
                      ? 'Schedule Publish'
                      : selectedTargets.size > 1
                      ? 'Publish to ' + selectedTargets.size + ' Sites'
                      : 'Publish Now'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
