'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import SocialPostCard from '@/components/social/SocialPostCard';
import QueueCard from '@/components/social/QueueCard';
import PersonGroupCard from '@/components/social/PersonGroupCard';
import type { PostingProfile } from '@/lib/optimal-timing';
import { useTrack } from '@/hooks/useTrack';
import { etDatetimeLocalValue } from '@/lib/date-utils';
import {
  HiOutlineMegaphone,
  HiOutlinePlusCircle,
  HiOutlineXMark,
  HiOutlineMagnifyingGlass,
  HiOutlineSparkles,
  HiOutlineArrowLeft,
  HiOutlinePencilSquare,
} from 'react-icons/hi2';
import { FaXTwitter, FaFacebook } from 'react-icons/fa6';

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

interface Article {
  id: string;
  headline: string;
  slug: string | null;
  featuredImage: string | null;
  publishedUrl: string | null;
  publishedSite: string | null;
  publishedAt: string | null;
  author: { name: string };
}

interface SocialAccount {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string;
  isActive: boolean;
  publishTarget: { id: string; name: string; url: string } | null;
  optimalHours: PostingProfile | null;
}

interface PostDraft {
  accountId: string;
  caption: string;
  scheduledAt: string;
  isGenerating: boolean;
}

interface PersonGroup {
  accountName: string;
  platforms: Set<string>;
  posts: SocialPost[];
  urgency: 'FAILED' | 'PENDING' | 'APPROVED' | 'SENT';
}

const urgencyRank: Record<string, number> = { FAILED: 0, PENDING: 1, APPROVED: 2, SENDING: 2, SENT: 3 };

function groupPostsByPerson(posts: SocialPost[]): PersonGroup[] {
  const map = new Map<string, PersonGroup>();

  for (const post of posts) {
    const name = post.socialAccount.accountName;
    let group = map.get(name);
    if (!group) {
      group = { accountName: name, platforms: new Set(), posts: [], urgency: 'SENT' };
      map.set(name, group);
    }
    group.platforms.add(post.socialAccount.platform);
    group.posts.push(post);
    // Most-urgent status wins
    if ((urgencyRank[post.status] ?? 3) < (urgencyRank[group.urgency] ?? 3)) {
      group.urgency = post.status === 'SENDING' ? 'APPROVED' : post.status as PersonGroup['urgency'];
    }
  }

  // Sort posts within each group by scheduledAt ascending
  const groups = Array.from(map.values());
  for (const group of groups) {
    group.posts.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  // Sort groups: FAILED first, PENDING second, APPROVED/SENT last, alpha within same urgency
  groups.sort((a, b) => {
    const ua = urgencyRank[a.urgency] ?? 3;
    const ub = urgencyRank[b.urgency] ?? 3;
    if (ua !== ub) return ua - ub;
    return a.accountName.localeCompare(b.accountName);
  });

  return groups;
}

export default function SocialQueuePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const track = useTrack('social_queue');

  // Two separate post lists
  const [scheduledPosts, setScheduledPosts] = useState<SocialPost[]>([]);
  const [postedPosts, setPostedPosts] = useState<SocialPost[]>([]);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(true);
  const [isLoadingPosted, setIsLoadingPosted] = useState(true);

  // Grouping state
  const [expandedScheduledGroups, setExpandedScheduledGroups] = useState<Set<string>>(new Set());
  const [expandedPostedGroups, setExpandedPostedGroups] = useState<Set<string>>(new Set());

  const scheduledGroups = useMemo(() => groupPostsByPerson(scheduledPosts), [scheduledPosts]);
  const postedGroups = useMemo(() => groupPostsByPerson(postedPosts), [postedPosts]);

  // Auto-expand FAILED/PENDING groups, collapse APPROVED
  useEffect(() => {
    const expanded = new Set<string>();
    for (const group of scheduledGroups) {
      if (group.urgency === 'FAILED' || group.urgency === 'PENDING') {
        expanded.add(group.accountName);
      }
    }
    setExpandedScheduledGroups(expanded);
  }, [scheduledGroups]);

  // Inline editing state
  const [regeneratingCaption, setRegeneratingCaption] = useState<string | null>(null);

  // Create Post modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<'article' | 'accounts'>('article');
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [articleSearch, setArticleSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedArticleUrl, setSelectedArticleUrl] = useState<string>('');
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [postDrafts, setPostDrafts] = useState<Map<string, PostDraft>>(new Map());
  const [isQueuingPosts, setIsQueuingPosts] = useState(false);

  const fetchScheduled = useCallback(async () => {
    setIsLoadingScheduled(true);
    try {
      const res = await fetch('/api/social/queue?limit=100');
      if (res.ok) {
        const data = await res.json();
        const all: SocialPost[] = data.posts || data;
        // Filter out SENT posts — those go in the right column
        setScheduledPosts(all.filter((p) => p.status !== 'SENT'));
      }
    } catch {
      toast.error('Failed to load scheduled posts');
    } finally {
      setIsLoadingScheduled(false);
    }
  }, []);

  const fetchPosted = useCallback(async () => {
    setIsLoadingPosted(true);
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch(
        `/api/social/queue?status=SENT&filterBy=sentAt&since=${encodeURIComponent(since)}&limit=50`
      );
      if (res.ok) {
        const data = await res.json();
        setPostedPosts(data.posts || data);
      }
    } catch {
      toast.error('Failed to load posted');
    } finally {
      setIsLoadingPosted(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    if (!['ADMIN', 'EDITOR'].includes(session?.user?.role)) {
      router.push('/dashboard');
      return;
    }
    fetchScheduled();
    fetchPosted();
  }, [session, router, fetchScheduled, fetchPosted]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchScheduled();
      fetchPosted();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchScheduled, fetchPosted]);

  // --- Action handlers ---

  async function handleApprove(postId: string) {
    track('social_queue', 'approve');
    try {
      const res = await fetch(`/api/social/queue/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setScheduledPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
        toast.success('Post approved');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to approve');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function handleSendNow(postId: string) {
    if (!confirm('Send this post immediately?')) return;
    track('social_queue', 'send_now');
    try {
      const res = await fetch(`/api/social/queue/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-now' }),
      });
      const data = await res.json();
      if (res.ok) {
        // Move from scheduled to posted
        setScheduledPosts((prev) => prev.filter((p) => p.id !== postId));
        setPostedPosts((prev) => [data, ...prev]);
        toast.success('Post sent!');
      } else {
        if (data.post) {
          setScheduledPosts((prev) => prev.map((p) => (p.id === postId ? data.post : p)));
        }
        toast.error(data.error || 'Failed to send');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function handleRetry(postId: string) {
    try {
      const res = await fetch(`/api/social/queue/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setScheduledPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
        toast.success('Post queued for retry');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to retry');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm('Delete this post from the queue?')) return;
    try {
      const res = await fetch(`/api/social/queue/${postId}`, { method: 'DELETE' });
      if (res.ok) {
        setScheduledPosts((prev) => prev.filter((p) => p.id !== postId));
        toast.success('Post deleted');
      } else {
        toast.error('Failed to delete');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function saveCaption(postId: string, newCaption: string) {
    try {
      const res = await fetch(`/api/social/queue/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: newCaption }),
      });
      if (res.ok) {
        const updated = await res.json();
        setScheduledPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
        toast.success('Caption updated');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update caption');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function saveSchedule(postId: string, newSchedule: string) {
    try {
      const res = await fetch(`/api/social/queue/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: newSchedule }),
      });
      if (res.ok) {
        const updated = await res.json();
        setScheduledPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
        toast.success('Schedule updated');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update schedule');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function handleRegenerateQueuedCaption(post: SocialPost) {
    setRegeneratingCaption(post.id);
    try {
      const res = await fetch('/api/social/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: post.articleId,
          socialAccountId: post.socialAccountId,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate caption');
      const { caption } = await res.json();
      await saveCaption(post.id, caption);
    } catch {
      toast.error('Failed to regenerate caption');
    } finally {
      setRegeneratingCaption(null);
    }
  }

  // --- Create Post modal logic ---

  function getSuggestedTime() {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return etDatetimeLocalValue(d);
  }

  async function openCreateModal() {
    track('social_queue', 'create_post');
    setShowCreateModal(true);
    setCreateStep('article');
    setSelectedArticle(null);
    setSelectedArticleUrl('');
    setArticleSearch('');
    setSelectedAccountIds(new Set());
    setPostDrafts(new Map());
    setIsQueuingPosts(false);

    setIsLoadingArticles(true);
    try {
      const res = await fetch('/api/articles?status=PUBLISHED&limit=50');
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
      } else {
        toast.error('Failed to load articles');
      }
    } catch {
      toast.error('Failed to load articles');
    } finally {
      setIsLoadingArticles(false);
    }
  }

  function closeCreateModal() {
    setShowCreateModal(false);
  }

  const filteredArticles = useMemo(() => {
    if (!articleSearch.trim()) return articles;
    const q = articleSearch.toLowerCase();
    return articles.filter((a) => a.headline.toLowerCase().includes(q));
  }, [articles, articleSearch]);

  async function handleSelectArticle(article: Article) {
    setSelectedArticle(article);
    const urls = article.publishedUrl ? article.publishedUrl.split(' | ') : [];
    setSelectedArticleUrl(urls[0] || '');
    setCreateStep('accounts');

    setIsLoadingAccounts(true);
    try {
      const res = await fetch('/api/social/accounts');
      if (res.ok) {
        const accounts: SocialAccount[] = await res.json();
        setSocialAccounts(accounts.filter((a) => a.isActive));
      } else {
        toast.error('Failed to load social accounts');
      }
    } catch {
      toast.error('Failed to load social accounts');
    } finally {
      setIsLoadingAccounts(false);
    }
  }

  function toggleAccountSelection(accountId: string) {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
        setPostDrafts((drafts) => {
          const updated = new Map(drafts);
          updated.delete(accountId);
          return updated;
        });
      } else {
        next.add(accountId);
      }
      return next;
    });
  }

  async function handleGenerateCaptions() {
    if (!selectedArticle || selectedAccountIds.size === 0) return;
    track('social_queue', 'generate_caption');

    const accountIds = Array.from(selectedAccountIds);
    const draftsMap = new Map<string, PostDraft>();
    for (const accountId of accountIds) {
      draftsMap.set(accountId, {
        accountId,
        caption: postDrafts.get(accountId)?.caption || '',
        scheduledAt: postDrafts.get(accountId)?.scheduledAt || getSuggestedTime(),
        isGenerating: true,
      });
    }
    setPostDrafts(new Map(draftsMap));

    for (const accountId of accountIds) {
      try {
        const res = await fetch('/api/social/generate-caption', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articleId: selectedArticle.id,
            socialAccountId: accountId,
          }),
        });
        if (!res.ok) throw new Error('Failed to generate caption');
        const { caption } = await res.json();

        setPostDrafts((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(accountId);
          if (existing) {
            updated.set(accountId, { ...existing, caption, isGenerating: false });
          }
          return updated;
        });
      } catch {
        toast.error('Failed to generate caption');
        setPostDrafts((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(accountId);
          if (existing) {
            updated.set(accountId, {
              ...existing,
              caption: 'Failed to generate. Please edit manually.',
              isGenerating: false,
            });
          }
          return updated;
        });
      }
    }
  }

  function handleWriteCaptions() {
    if (!selectedArticle || selectedAccountIds.size === 0) return;

    const accountIds = Array.from(selectedAccountIds);
    const draftsMap = new Map<string, PostDraft>();
    for (const accountId of accountIds) {
      draftsMap.set(accountId, {
        accountId,
        caption: '',
        scheduledAt: getSuggestedTime(),
        isGenerating: false,
      });
    }
    setPostDrafts(new Map(draftsMap));
  }

  async function handleRegenerateCaption(accountId: string) {
    if (!selectedArticle) return;

    setPostDrafts((prev) => {
      const updated = new Map(prev);
      const existing = updated.get(accountId);
      if (existing) {
        updated.set(accountId, { ...existing, isGenerating: true });
      }
      return updated;
    });

    try {
      const res = await fetch('/api/social/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: selectedArticle.id,
          socialAccountId: accountId,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate caption');
      const { caption } = await res.json();

      setPostDrafts((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(accountId);
        if (existing) {
          updated.set(accountId, { ...existing, caption, isGenerating: false });
        }
        return updated;
      });
    } catch {
      toast.error('Failed to regenerate caption');
      setPostDrafts((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(accountId);
        if (existing) {
          updated.set(accountId, { ...existing, isGenerating: false });
        }
        return updated;
      });
    }
  }

  async function handleQueuePosts() {
    if (!selectedArticle || postDrafts.size === 0) return;

    const invalidDrafts = Array.from(postDrafts.values()).filter(
      (d) => !d.caption.trim() || !d.scheduledAt
    );
    if (invalidDrafts.length > 0) {
      toast.error('Please complete all captions and scheduled times');
      return;
    }

    setIsQueuingPosts(true);

    try {
      const articleUrl = selectedArticleUrl;

      const postsPayload = Array.from(postDrafts.values()).map((draft) => ({
        articleId: selectedArticle.id,
        socialAccountId: draft.accountId,
        caption: draft.caption,
        imageUrl: selectedArticle.featuredImage || undefined,
        articleUrl,
        scheduledAt: new Date(draft.scheduledAt).toISOString(),
        status: 'PENDING' as const,
      }));

      const res = await fetch('/api/social/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: postsPayload }),
      });

      if (!res.ok) throw new Error('Failed to queue posts');
      const data = await res.json();

      toast.success(`Queued ${data.count} post${data.count > 1 ? 's' : ''}!`);
      closeCreateModal();
      fetchScheduled();
    } catch {
      toast.error('Failed to queue posts');
    } finally {
      setIsQueuingPosts(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-press-50 dark:bg-press-900/30 flex items-center justify-center">
              <HiOutlineMegaphone className="w-5 h-5 text-press-600 dark:text-press-400" />
            </div>
            <h1 className="font-display text-display-md text-ink-950 dark:text-ink-50">Social Queue</h1>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-press-600 text-white text-sm font-medium rounded-lg hover:bg-press-700 transition-colors"
          >
            <HiOutlinePlusCircle className="w-4 h-4" />
            Create Post
          </button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left column: Post Scheduler (60%) */}
          <div className="lg:col-span-3">
            <div className="mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                Post Scheduler
              </h2>
            </div>

            {isLoadingScheduled ? (
              <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-8 text-center">
                <p className="text-ink-400 text-sm">Loading posts...</p>
              </div>
            ) : scheduledGroups.length > 0 ? (
              <div className="space-y-2">
                {scheduledGroups.map((group) => (
                  <PersonGroupCard
                    key={group.accountName}
                    accountName={group.accountName}
                    platforms={group.platforms}
                    postCount={group.posts.length}
                    urgency={group.urgency}
                    isExpanded={expandedScheduledGroups.has(group.accountName)}
                    onToggle={() =>
                      setExpandedScheduledGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.accountName)) next.delete(group.accountName);
                        else next.add(group.accountName);
                        return next;
                      })
                    }
                    variant="scheduled"
                  >
                    {group.posts.map((post) => (
                      <QueueCard
                        key={post.id}
                        post={post}
                        variant="scheduled"
                        onApprove={handleApprove}
                        onSendNow={handleSendNow}
                        onRetry={handleRetry}
                        onDelete={handleDelete}
                        onSaveCaption={saveCaption}
                        onSaveSchedule={saveSchedule}
                        onRegenerate={handleRegenerateQueuedCaption}
                        isRegenerating={regeneratingCaption === post.id}
                      />
                    ))}
                  </PersonGroupCard>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-8 text-center">
                <HiOutlineMegaphone className="w-10 h-10 text-ink-200 dark:text-ink-700 mx-auto mb-3" />
                <h3 className="font-display text-base text-ink-700 dark:text-ink-300 mb-1">No posts scheduled</h3>
                <p className="text-ink-400 text-sm">Create a post to get started.</p>
              </div>
            )}
          </div>

          {/* Right column: Posted (40%) — dark background */}
          <div className="lg:col-span-2">
            <div className="mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                Posted
                <span className="ml-2 text-ink-400 dark:text-ink-500 font-normal normal-case">last 24h</span>
              </h2>
            </div>

            <div className="bg-ink-900 dark:bg-ink-950 rounded-xl border border-ink-800 p-3 min-h-[200px]">
              {isLoadingPosted ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-ink-500 text-sm">Loading...</p>
                </div>
              ) : postedGroups.length > 0 ? (
                <div className="space-y-2">
                  {postedGroups.map((group) => (
                    <PersonGroupCard
                      key={group.accountName}
                      accountName={group.accountName}
                      platforms={group.platforms}
                      postCount={group.posts.length}
                      urgency={group.urgency}
                      isExpanded={expandedPostedGroups.has(group.accountName)}
                      onToggle={() =>
                        setExpandedPostedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.accountName)) next.delete(group.accountName);
                          else next.add(group.accountName);
                          return next;
                        })
                      }
                      variant="posted"
                    >
                      {group.posts.map((post) => (
                        <QueueCard
                          key={post.id}
                          post={post}
                          variant="posted"
                        />
                      ))}
                    </PersonGroupCard>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-ink-500 text-sm">No posts in the last 24 hours</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Post Modal — copied verbatim from previous implementation */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeCreateModal}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-ink-900 w-full max-w-full md:max-w-2xl max-h-[90dvh] md:max-h-[85vh] overflow-hidden flex flex-col fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto rounded-t-2xl md:rounded-2xl shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-ink-100 dark:border-ink-800">
              <div className="flex items-center gap-3">
                {createStep === 'accounts' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCreateStep('article');
                      setSelectedArticle(null);
                      setSelectedArticleUrl('');
                      setSelectedAccountIds(new Set());
                      setPostDrafts(new Map());
                    }}
                    className="p-1 text-ink-400 hover:text-ink-600 transition-colors"
                  >
                    <HiOutlineArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <h2 className="font-display text-lg text-ink-900 dark:text-ink-100">
                  {createStep === 'article' ? 'Select Article' : 'Create Social Posts'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="p-1 text-ink-400 hover:text-ink-600 transition-colors"
              >
                <HiOutlineXMark className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
              {/* Step 1: Article Selection */}
              {createStep === 'article' && (
                <div>
                  <div className="relative mb-4">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                    <input
                      type="text"
                      value={articleSearch}
                      onChange={(e) => setArticleSearch(e.target.value)}
                      placeholder="Search articles by headline..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-ink-200 dark:border-ink-700 text-sm bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:border-press-500"
                      autoFocus
                    />
                  </div>

                  {isLoadingArticles ? (
                    <div className="text-center py-8">
                      <p className="text-ink-400 text-sm">Loading articles...</p>
                    </div>
                  ) : filteredArticles.length > 0 ? (
                    <div className="border border-ink-200 dark:border-ink-700 rounded-lg divide-y divide-ink-100 dark:divide-ink-800 max-h-[50vh] md:max-h-96 overflow-y-auto">
                      {filteredArticles.map((article) => (
                        <button
                          key={article.id}
                          type="button"
                          onClick={() => handleSelectArticle(article)}
                          className="w-full text-left p-3 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
                        >
                          <p className="text-sm font-medium text-ink-900 dark:text-ink-100 line-clamp-2">
                            {article.headline}
                          </p>
                          <p className="text-xs text-ink-500 mt-1">
                            {article.author?.name || 'Unknown author'}
                            {article.publishedAt && (
                              <> &middot; Published {new Date(article.publishedAt).toLocaleDateString()}</>
                            )}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-ink-200 dark:border-ink-700 rounded-lg">
                      <p className="text-ink-400 text-sm">
                        {articleSearch ? 'No articles match your search' : 'No published articles found'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Accounts + Captions */}
              {createStep === 'accounts' && selectedArticle && (
                <div>
                  {/* Selected article summary */}
                  <div className="bg-ink-50 dark:bg-ink-800/50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-ink-500 mb-1">Article</p>
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                      {selectedArticle.headline}
                    </p>
                  </div>

                  {/* URL picker — shown when article is published to multiple sites */}
                  {(() => {
                    const urls = selectedArticle.publishedUrl ? selectedArticle.publishedUrl.split(' | ') : [];
                    const sites = selectedArticle.publishedSite ? selectedArticle.publishedSite.split(' | ') : [];
                    if (urls.length > 1) {
                      return (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-ink-700 dark:text-ink-300 mb-2">
                            Link to include with posts
                          </p>
                          <div className="border border-ink-200 dark:border-ink-700 rounded-lg divide-y divide-ink-100 dark:divide-ink-800">
                            {urls.map((url, i) => (
                              <label
                                key={url}
                                className="flex items-center gap-3 p-3 hover:bg-ink-50 dark:hover:bg-ink-800 cursor-pointer"
                              >
                                <input
                                  type="radio"
                                  name="articleUrl"
                                  checked={selectedArticleUrl === url}
                                  onChange={() => setSelectedArticleUrl(url)}
                                  className="w-4 h-4 border-ink-300 text-press-600 focus:ring-press-500"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                                    {sites[i] || 'Unknown site'}
                                  </p>
                                  <p className="text-xs text-ink-400 truncate">{url}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Account selection */}
                  {isLoadingAccounts ? (
                    <div className="text-center py-8">
                      <p className="text-ink-400 text-sm">Loading accounts...</p>
                    </div>
                  ) : socialAccounts.length > 0 ? (
                    <>
                      {/* Account checkboxes (only shown if no drafts generated yet) */}
                      {postDrafts.size === 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-ink-700 dark:text-ink-300 mb-2">
                            Select accounts
                          </p>
                          <div className="border border-ink-200 dark:border-ink-700 rounded-lg divide-y divide-ink-100 dark:divide-ink-800">
                            {socialAccounts.map((account) => (
                              <label
                                key={account.id}
                                className="flex items-center gap-3 p-3 hover:bg-ink-50 dark:hover:bg-ink-800 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedAccountIds.has(account.id)}
                                  onChange={() => toggleAccountSelection(account.id)}
                                  className="w-4 h-4 rounded border-ink-300 text-press-600 focus:ring-press-500"
                                />
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${
                                    account.platform === 'X' ? 'bg-black' : account.platform === 'FACEBOOK' ? 'bg-blue-600' : 'bg-ink-600'
                                  }`}>
                                    {account.platform === 'X' && <FaXTwitter className="w-3.5 h-3.5" />}
                                    {account.platform === 'FACEBOOK' && <FaFacebook className="w-3.5 h-3.5" />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                                      {account.accountName}
                                    </p>
                                    <p className="text-xs text-ink-400">
                                      {account.platform !== 'FACEBOOK' && <>@{account.accountHandle}</>}
                                      {account.platform !== 'FACEBOOK' && account.publishTarget && <> &middot; </>}
                                      {account.publishTarget && account.publishTarget.name}
                                    </p>
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleGenerateCaptions}
                              disabled={selectedAccountIds.size === 0}
                              className="flex items-center gap-2 px-4 py-2 bg-press-600 text-white text-sm font-medium rounded-lg hover:bg-press-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <HiOutlineSparkles className="w-4 h-4" />
                              Generate Captions
                            </button>
                            <button
                              type="button"
                              onClick={handleWriteCaptions}
                              disabled={selectedAccountIds.size === 0}
                              className="flex items-center gap-2 px-4 py-2 border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-300 text-sm font-medium rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <HiOutlinePencilSquare className="w-4 h-4" />
                              Write Caption
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Post drafts (SocialPostCard for each) */}
                      {postDrafts.size > 0 && (
                        <div className="space-y-4">
                          {Array.from(postDrafts.entries()).map(([accountId, draft]) => {
                            const account = socialAccounts.find((a) => a.id === accountId);
                            if (!account) return null;

                            return (
                              <SocialPostCard
                                key={accountId}
                                account={account}
                                caption={draft.caption}
                                onCaptionChange={(caption) => {
                                  setPostDrafts((prev) => {
                                    const updated = new Map(prev);
                                    const existing = updated.get(accountId);
                                    if (existing) {
                                      updated.set(accountId, { ...existing, caption });
                                    }
                                    return updated;
                                  });
                                }}
                                scheduledAt={draft.scheduledAt}
                                onScheduledAtChange={(scheduledAt) => {
                                  setPostDrafts((prev) => {
                                    const updated = new Map(prev);
                                    const existing = updated.get(accountId);
                                    if (existing) {
                                      updated.set(accountId, { ...existing, scheduledAt });
                                    }
                                    return updated;
                                  });
                                }}
                                imageUrl={selectedArticle.featuredImage || undefined}
                                articleUrl={selectedArticleUrl}
                                isGenerating={draft.isGenerating}
                                onRegenerate={() => handleRegenerateCaption(accountId)}
                                onRemove={() => {
                                  setPostDrafts((prev) => {
                                    const updated = new Map(prev);
                                    updated.delete(accountId);
                                    return updated;
                                  });
                                  setSelectedAccountIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(accountId);
                                    return next;
                                  });
                                }}
                                postingProfile={account.optimalHours}
                              />
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 border border-ink-200 dark:border-ink-700 rounded-lg">
                      <p className="text-ink-400 text-sm">No active social accounts found</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {createStep === 'accounts' && postDrafts.size > 0 && (
              <div className="px-4 md:px-6 py-4 border-t border-ink-100 dark:border-ink-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 text-sm font-medium text-ink-600 hover:text-ink-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleQueuePosts}
                  disabled={isQueuingPosts || postDrafts.size === 0}
                  className="px-4 py-2 bg-press-600 text-white text-sm font-medium rounded-lg hover:bg-press-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isQueuingPosts ? 'Queuing...' : `Queue ${postDrafts.size} Post${postDrafts.size > 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
