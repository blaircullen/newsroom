'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import {
  HiOutlineMegaphone,
  HiOutlineTrash,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineClock,
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
        setPosts(await res.json());
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

      if (res.ok) {
        const updated = await res.json();
        setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
        toast.success('Post scheduled to send now');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to send');
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
    </AppShell>
  );
}
