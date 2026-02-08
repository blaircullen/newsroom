'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import SocialPostCard from '@/components/social/SocialPostCard';
import PostingHeatmap from '@/components/social/PostingHeatmap';
import type { PostingProfile } from '@/lib/optimal-timing';
import {
  HiOutlineMegaphone,
  HiOutlineTrash,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlinePlusCircle,
  HiOutlineXMark,
  HiOutlineMagnifyingGlass,
  HiOutlineSparkles,
  HiOutlineArrowLeft,
  HiOutlinePencilSquare,
  HiOutlineChartBarSquare,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
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

export default function SocialQueuePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
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
  const [showInsights, setShowInsights] = useState(false);

  useEffect(() => {
    if (!session) return;
    if (!['ADMIN', 'EDITOR'].includes(session?.user?.role)) {
      router.push('/dashboard');
      return;
    }
    fetchPosts();
  }, [session, router, selectedDate, statusFilter, platformFilter]);

  async function fetchPosts() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.append('date', selectedDate);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (platformFilter !== 'ALL') params.append('platform', platformFilter);

      const res = await fetch(`/api/social/queue?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || data);
      } else {
        toast.error('Failed to load posts');
      }
    } catch {
      toast.error('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove(postId: string) {
    try {
      const res = await fetch(`/api/social/queue/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (res.ok) {
        const updated = await res.json();
        setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
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
    try {
      const res = await fetch(`/api/social/queue/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-now' }),
      });

      const data = await res.json();
      if (res.ok) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? data : p)));
        toast.success('Post sent!');
      } else {
        // Update the post state if returned (e.g. FAILED status)
        if (data.post) {
          setPosts((prev) => prev.map((p) => (p.id === postId ? data.post : p)));
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
        setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
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
      const res = await fetch(`/api/social/queue/${postId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
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
        setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
        toast.success('Caption updated');
        setEditingCaption(null);
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
        setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
        toast.success('Schedule updated');
        setEditingSchedule(null);
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

      // Save the new caption to the queued post
      await saveCaption(post.id, caption);
    } catch {
      toast.error('Failed to regenerate caption');
    } finally {
      setRegeneratingCaption(null);
    }
  }

  function getPlatformIcon(platform: string) {
    switch (platform) {
      case 'X':
        return <FaXTwitter className="w-4 h-4" />;
      case 'FACEBOOK':
        return <FaFacebook className="w-4 h-4" />;
      default:
        return null;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'PENDING':
        return (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
            Pending
          </span>
        );
      case 'APPROVED':
        return (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            Approved
          </span>
        );
      case 'SENDING':
        return (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700">
            Sending
          </span>
        );
      case 'SENT':
        return (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            Sent
          </span>
        );
      case 'FAILED':
        return (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            Failed
          </span>
        );
      default:
        return null;
    }
  }

  function formatDateTime(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function setToday() {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  }

  // --- Create Post modal logic ---

  function getSuggestedTime() {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  }

  async function openCreateModal() {
    setShowCreateModal(true);
    setCreateStep('article');
    setSelectedArticle(null);
    setSelectedArticleUrl('');
    setArticleSearch('');
    setSelectedAccountIds(new Set());
    setPostDrafts(new Map());
    setIsQueuingPosts(false);

    // Fetch published articles
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
    // Pre-select first published URL
    const urls = article.publishedUrl ? article.publishedUrl.split(' | ') : [];
    setSelectedArticleUrl(urls[0] || '');
    setCreateStep('accounts');

    // Fetch social accounts
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
        // Remove draft too
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

    // Initialize drafts for all selected accounts
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

    // Generate captions for each account
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
      fetchPosts();
    } catch {
      toast.error('Failed to queue posts');
    } finally {
      setIsQueuingPosts(false);
    }
  }

  // Calculate stats
  const stats = {
    pending: posts.filter((p) => p.status === 'PENDING').length,
    approved: posts.filter((p) => p.status === 'APPROVED').length,
    sent: posts.filter((p) => p.status === 'SENT').length,
    failed: posts.filter((p) => p.status === 'FAILED').length,
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-press-50 flex items-center justify-center">
              <HiOutlineMegaphone className="w-5 h-5 text-press-600" />
            </div>
            <div>
              <h1 className="font-display text-display-md text-ink-950">Social Queue</h1>
              <p className="text-ink-400 text-sm">Manage scheduled social media posts</p>
            </div>
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

        {/* Filters Bar */}
        <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Date Picker */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-ink-600">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500"
              />
              <button
                type="button"
                onClick={setToday}
                className="px-3 py-1.5 text-xs font-medium text-press-600 hover:bg-press-50 rounded-lg transition-colors"
              >
                Today
              </button>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-ink-600">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 bg-white"
              >
                <option value="ALL">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="SENDING">Sending</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            {/* Platform Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-ink-600">Platform:</label>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 bg-white"
              >
                <option value="ALL">All</option>
                <option value="X">X</option>
                <option value="FACEBOOK">Facebook</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3 mb-6">
          <div className="text-xs font-medium px-3 py-1.5 rounded-full bg-yellow-50 text-yellow-700">
            {stats.pending} Pending
          </div>
          <div className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-50 text-blue-700">
            {stats.approved} Approved
          </div>
          <div className="text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">
            {stats.sent} Sent
          </div>
          {stats.failed > 0 && (
            <div className="text-xs font-medium px-3 py-1.5 rounded-full bg-red-50 text-red-700">
              {stats.failed} Failed
            </div>
          )}
        </div>

        {/* Posting Insights (collapsible heatmap) */}
        {socialAccounts.length > 0 && socialAccounts.some(a => a.optimalHours) && (
          <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 mb-6">
            <button
              type="button"
              onClick={() => setShowInsights(!showInsights)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800/50 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-2">
                <HiOutlineChartBarSquare className="w-4 h-4" />
                Posting Insights
              </div>
              {showInsights ? (
                <HiOutlineChevronUp className="w-4 h-4" />
              ) : (
                <HiOutlineChevronDown className="w-4 h-4" />
              )}
            </button>
            {showInsights && (
              <div className="px-4 pb-4 space-y-4">
                {socialAccounts.filter(a => a.optimalHours).map(account => (
                  <div key={account.id}>
                    <p className="text-xs font-medium text-ink-500 mb-2">
                      {account.accountName} (@{account.accountHandle})
                    </p>
                    {account.optimalHours && <PostingHeatmap profile={account.optimalHours} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Queue List */}
        {isLoading ? (
          <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-8 text-center">
            <p className="text-ink-400 text-sm">Loading posts...</p>
          </div>
        ) : posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-4"
              >
                <div className="flex items-start gap-4">
                  {/* Platform Icon + Handle */}
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white">
                      {getPlatformIcon(post.socialAccount.platform)}
                    </div>
                    <span className="text-sm font-medium text-ink-600">
                      {post.socialAccount.accountHandle}
                    </span>
                  </div>

                  {/* Post Details */}
                  <div className="flex-1 min-w-0">
                    {/* Article Headline */}
                    <h3 className="text-sm font-semibold text-ink-900 mb-2">
                      {post.article.headline}
                    </h3>

                    {/* Caption */}
                    {editingCaption === post.id ? (
                      <textarea
                        defaultValue={post.caption}
                        onBlur={(e) => saveCaption(post.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingCaption(null);
                          if (e.key === 'Enter' && e.metaKey) {
                            saveCaption(post.id, e.currentTarget.value);
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-press-500 text-sm focus:outline-none"
                        rows={3}
                        autoFocus
                      />
                    ) : (
                      <p
                        onClick={() => {
                          if (['PENDING', 'APPROVED', 'FAILED'].includes(post.status)) {
                            setEditingCaption(post.id);
                          }
                        }}
                        className={`text-sm text-ink-600 mb-3 ${
                          ['PENDING', 'APPROVED', 'FAILED'].includes(post.status)
                            ? 'cursor-pointer hover:bg-ink-50 rounded p-2 -m-2'
                            : ''
                        }`}
                      >
                        {post.caption}
                      </p>
                    )}

                    {/* Regenerate button for editable posts */}
                    {['PENDING', 'APPROVED', 'FAILED'].includes(post.status) && (
                      <button
                        type="button"
                        onClick={() => handleRegenerateQueuedCaption(post)}
                        disabled={regeneratingCaption === post.id}
                        className="flex items-center gap-1.5 px-2 py-1 mb-2 text-xs font-medium text-press-600 dark:text-press-400 hover:text-press-700 dark:hover:text-press-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <HiOutlineSparkles className="w-3.5 h-3.5" />
                        {regeneratingCaption === post.id ? 'Regenerating...' : 'Regenerate caption'}
                      </button>
                    )}

                    {/* Scheduled Time & Status */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {editingSchedule === post.id ? (
                        <input
                          type="datetime-local"
                          defaultValue={new Date(post.scheduledAt).toISOString().slice(0, 16)}
                          onBlur={(e) => saveSchedule(post.id, new Date(e.target.value).toISOString())}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingSchedule(null);
                            if (e.key === 'Enter') {
                              saveSchedule(post.id, new Date(e.currentTarget.value).toISOString());
                            }
                          }}
                          className="px-3 py-1 rounded-lg border border-press-500 text-xs focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (['PENDING', 'APPROVED', 'FAILED'].includes(post.status)) {
                              setEditingSchedule(post.id);
                            }
                          }}
                          disabled={!['PENDING', 'APPROVED', 'FAILED'].includes(post.status)}
                          className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-700"
                        >
                          <HiOutlineClock className="w-3.5 h-3.5" />
                          {formatDateTime(post.scheduledAt)}
                        </button>
                      )}

                      {getStatusBadge(post.status)}

                      {post.status === 'SENT' && post.sentAt && (
                        <span className="text-xs text-ink-400">
                          Sent {formatDateTime(post.sentAt)}
                        </span>
                      )}
                    </div>

                    {/* Error Message */}
                    {post.status === 'FAILED' && post.errorMessage && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg p-2">
                        {post.errorMessage}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {post.status === 'PENDING' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApprove(post.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <HiOutlineCheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(post.id)}
                          className="p-1.5 text-ink-400 hover:text-red-500 transition-colors rounded-lg"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {post.status === 'APPROVED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSendNow(post.id)}
                          className="px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          Send Now
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(post.id)}
                          className="p-1.5 text-ink-400 hover:text-red-500 transition-colors rounded-lg"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {post.status === 'FAILED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRetry(post.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                        >
                          <HiOutlineArrowPath className="w-4 h-4" />
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(post.id)}
                          className="p-1.5 text-ink-400 hover:text-red-500 transition-colors rounded-lg"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {post.status === 'SENT' && post.platformPostId && (
                      <a
                        href={
                          post.socialAccount.platform === 'X'
                            ? `https://x.com/${post.socialAccount.accountHandle.replace('@', '')}/status/${post.platformPostId}`
                            : '#'
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 text-xs font-medium text-press-600 hover:bg-press-50 rounded-lg transition-colors"
                      >
                        View
                      </a>
                    )}

                    {post.status === 'SENDING' && (
                      <div className="text-xs text-purple-600 animate-pulse">Sending...</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-8 text-center">
            <HiOutlineMegaphone className="w-12 h-12 text-ink-200 mx-auto mb-4" />
            <h3 className="font-display text-lg text-ink-700 mb-2">No social posts scheduled</h3>
            <p className="text-ink-400 text-sm">
              {selectedDate
                ? 'No posts scheduled for this date.'
                : 'Schedule posts from the article editor.'}
            </p>
          </div>
        )}
      </div>

      {/* Create Post Modal */}
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
                                      @{account.accountHandle}
                                      {account.publishTarget && (
                                        <> &middot; {account.publishTarget.name}</>
                                      )}
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
