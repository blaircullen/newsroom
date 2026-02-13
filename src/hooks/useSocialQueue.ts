import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTrack } from '@/hooks/useTrack';
import { etDateString, etMidnightToUTC } from '@/lib/date-utils';
import type {
  SocialPostData,
  AccountGroup,
  SidebarStats,
  PostStatus,
  SocialPlatform,
  ViewTab,
  DateFilter,
} from '@/types/social';

const urgencyRank: Record<string, number> = { FAILED: 0, PENDING: 1, APPROVED: 2, SENDING: 2, SENT: 3 };

function groupPostsByAccount(posts: SocialPostData[]): AccountGroup[] {
  const map = new Map<string, AccountGroup>();

  for (const post of posts) {
    const key = post.socialAccountId;
    let group = map.get(key);
    if (!group) {
      group = {
        socialAccountId: key,
        accountName: post.socialAccount.accountName,
        accountHandle: post.socialAccount.accountHandle,
        avatarUrl: post.socialAccount.avatarUrl,
        platform: post.socialAccount.platform,
        siteName: post.socialAccount.publishTarget?.name ?? null,
        faviconColor: post.socialAccount.publishTarget?.faviconColor ?? null,
        posts: [],
        urgency: 'SENT',
      };
      map.set(key, group);
    }
    group.posts.push(post);
    if ((urgencyRank[post.status] ?? 3) < (urgencyRank[group.urgency] ?? 3)) {
      group.urgency = (post.status === 'SENDING' ? 'APPROVED' : post.status) as AccountGroup['urgency'];
    }
  }

  const groups = Array.from(map.values());
  for (const g of groups) {
    g.posts.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }
  groups.sort((a, b) => {
    const ua = urgencyRank[a.urgency] ?? 3;
    const ub = urgencyRank[b.urgency] ?? 3;
    if (ua !== ub) return ua - ub;
    return a.accountName.localeCompare(b.accountName);
  });

  return groups;
}

export function useSocialQueue() {
  const track = useTrack('social_queue');

  // Core data
  const [posts, setPosts] = useState<SocialPostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<SidebarStats>({ failed: 0, pending: 0, approved: 0, sentLast24h: 0, sites: [] });

  // View state
  const [activeView, setActiveView] = useState<ViewTab>('queue');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<PostStatus | null>(null);
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | null>(null);
  const [siteFilter, setSiteFilter] = useState<string | null>(null);

  // Selection state
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Regeneration state
  const [regeneratingCaption, setRegeneratingCaption] = useState<string | null>(null);

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (platformFilter) params.set('platform', platformFilter);
      if (siteFilter) params.set('publishTargetId', siteFilter);

      const res = await fetch(`/api/social/queue?${params}`);
      if (res.ok) {
        const data = await res.json();
        const allPosts: SocialPostData[] = data.posts || data;
        setPosts(allPosts);
      }
    } catch {
      toast.error('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, platformFilter, siteFilter]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/social/queue/stats');
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // Silent fail for stats
    }
  }, []);

  // Initial load + auto-refresh
  useEffect(() => {
    fetchPosts();
    fetchStats();
  }, [fetchPosts, fetchStats]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPosts();
      fetchStats();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchPosts, fetchStats]);

  // Filtered posts (client-side date filter)
  const filteredPosts = useMemo(() => {
    if (dateFilter === 'all') return posts;

    const now = new Date();
    const todayStr = etDateString(now);
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = etDateString(tomorrowDate);

    return posts.filter((post) => {
      const postDateStr = etDateString(new Date(post.scheduledAt));
      switch (dateFilter) {
        case 'today':
          return postDateStr === todayStr;
        case 'tomorrow':
          return postDateStr === tomorrowStr;
        case 'week': {
          const weekEnd = new Date(now);
          weekEnd.setDate(weekEnd.getDate() + 7);
          const postDate = new Date(post.scheduledAt);
          return postDate >= etMidnightToUTC(todayStr) && postDate <= weekEnd;
        }
        default:
          return true;
      }
    });
  }, [posts, dateFilter]);

  // Group by account
  const accountGroups = useMemo(() => groupPostsByAccount(filteredPosts), [filteredPosts]);

  // Auto-expand logic (only on initial load)
  const hasInitialExpanded = useRef(false);
  useEffect(() => {
    if (hasInitialExpanded.current || accountGroups.length === 0) return;
    hasInitialExpanded.current = true;

    const expanded = new Set<string>();
    let postCount = 0;

    for (const group of accountGroups) {
      if (group.urgency === 'FAILED' || group.urgency === 'PENDING') {
        expanded.add(group.socialAccountId);
        postCount += group.posts.length;
      }
    }
    for (const group of accountGroups) {
      if (postCount >= 4) break;
      if (!expanded.has(group.socialAccountId)) {
        expanded.add(group.socialAccountId);
        postCount += group.posts.length;
      }
    }
    setExpandedGroups(expanded);
  }, [accountGroups]);

  // Toggle group
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // Selection helpers
  const togglePostSelection = useCallback((postId: string) => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedPostIds(new Set()), []);

  const selectAllInGroup = useCallback((groupId: string) => {
    const group = accountGroups.find((g) => g.socialAccountId === groupId);
    if (!group) return;
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      for (const post of group.posts) next.add(post.id);
      return next;
    });
  }, [accountGroups]);

  // Single post actions
  async function approve(postId: string) {
    track('social_queue', 'approve');
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

  async function sendNow(postId: string) {
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
        setPosts((prev) => prev.map((p) => (p.id === postId ? data : p)));
        toast.success('Post sent!');
      } else {
        if (data.post) {
          setPosts((prev) => prev.map((p) => (p.id === postId ? data.post : p)));
        }
        toast.error(data.error || 'Failed to send');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function retry(postId: string) {
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

  async function deletePost(postId: string) {
    if (!confirm('Delete this post from the queue?')) return;
    try {
      const res = await fetch(`/api/social/queue/${postId}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setSelectedPostIds((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
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
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update schedule');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function regenerateCaption(post: SocialPostData) {
    setRegeneratingCaption(post.id);
    try {
      const res = await fetch('/api/social/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: post.articleId, socialAccountId: post.socialAccountId }),
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

  // Batch actions
  async function batchApprove() {
    if (selectedPostIds.size === 0) return;
    try {
      const res = await fetch('/api/social/queue/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', postIds: Array.from(selectedPostIds) }),
      });
      if (res.ok) {
        const { updated } = await res.json();
        setPosts((prev) =>
          prev.map((p) =>
            selectedPostIds.has(p.id) && p.status === 'PENDING' ? { ...p, status: 'APPROVED' as PostStatus } : p
          )
        );
        clearSelection();
        toast.success(`Approved ${updated} post${updated !== 1 ? 's' : ''}`);
      } else {
        toast.error('Batch approve failed');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function batchDelete() {
    if (selectedPostIds.size === 0) return;
    if (!confirm(`Delete ${selectedPostIds.size} post${selectedPostIds.size !== 1 ? 's' : ''}?`)) return;
    try {
      const res = await fetch('/api/social/queue/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', postIds: Array.from(selectedPostIds) }),
      });
      if (res.ok) {
        const { deleted } = await res.json();
        setPosts((prev) => prev.filter((p) => !selectedPostIds.has(p.id)));
        clearSelection();
        toast.success(`Deleted ${deleted} post${deleted !== 1 ? 's' : ''}`);
      } else {
        toast.error('Batch delete failed');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  return {
    // Data
    posts: filteredPosts,
    accountGroups,
    stats,
    isLoading,

    // View
    activeView,
    setActiveView,

    // Filters
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    statusFilter,
    setStatusFilter,
    platformFilter,
    setPlatformFilter,
    siteFilter,
    setSiteFilter,

    // Selection
    selectedPostIds,
    togglePostSelection,
    clearSelection,
    selectAllInGroup,

    // Expansion
    expandedGroups,
    toggleGroup,

    // Single actions
    approve,
    sendNow,
    retry,
    deletePost,
    saveCaption,
    saveSchedule,
    regenerateCaption,
    regeneratingCaption,

    // Batch actions
    batchApprove,
    batchDelete,

    // Refresh
    refresh: fetchPosts,
  };
}
