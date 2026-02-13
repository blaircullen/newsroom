import { useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTrack } from '@/hooks/useTrack';
import { etDatetimeLocalValue } from '@/lib/date-utils';
import type { ArticleData, SocialAccountData, PostDraft } from '@/types/social';

export function useCreatePostModal(onPostsQueued: () => void) {
  const track = useTrack('social_queue');

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'article' | 'accounts'>('article');

  // Article state
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [articleSearch, setArticleSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<ArticleData | null>(null);
  const [selectedArticleUrl, setSelectedArticleUrl] = useState('');

  // Accounts state
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountData[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [postDrafts, setPostDrafts] = useState<Map<string, PostDraft>>(new Map());
  const [isQueuingPosts, setIsQueuingPosts] = useState(false);

  function getSuggestedTime() {
    return etDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
  }

  const open = useCallback(async () => {
    track('social_queue', 'create_post');
    setIsOpen(true);
    setStep('article');
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
  }, [track]);

  const close = useCallback(() => setIsOpen(false), []);

  const filteredArticles = useMemo(() => {
    if (!articleSearch.trim()) return articles;
    const q = articleSearch.toLowerCase();
    return articles.filter((a) => a.headline.toLowerCase().includes(q));
  }, [articles, articleSearch]);

  const selectArticle = useCallback(async (article: ArticleData) => {
    setSelectedArticle(article);
    const urls = article.publishedUrl ? article.publishedUrl.split(' | ') : [];
    setSelectedArticleUrl(urls[0] || '');
    setStep('accounts');

    setIsLoadingAccounts(true);
    try {
      const res = await fetch('/api/social/accounts');
      if (res.ok) {
        const accounts: SocialAccountData[] = await res.json();
        setSocialAccounts(accounts.filter((a) => a.isActive));
      } else {
        toast.error('Failed to load social accounts');
      }
    } catch {
      toast.error('Failed to load social accounts');
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  const goBackToArticle = useCallback(() => {
    setStep('article');
    setSelectedArticle(null);
    setSelectedArticleUrl('');
    setSelectedAccountIds(new Set());
    setPostDrafts(new Map());
  }, []);

  const toggleAccount = useCallback((accountId: string) => {
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
  }, []);

  const generateCaptions = useCallback(async () => {
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
          body: JSON.stringify({ articleId: selectedArticle.id, socialAccountId: accountId }),
        });
        if (!res.ok) throw new Error('Failed');
        const { caption } = await res.json();

        setPostDrafts((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(accountId);
          if (existing) updated.set(accountId, { ...existing, caption, isGenerating: false });
          return updated;
        });
      } catch {
        toast.error('Failed to generate caption');
        setPostDrafts((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(accountId);
          if (existing) updated.set(accountId, { ...existing, caption: 'Failed to generate. Please edit manually.', isGenerating: false });
          return updated;
        });
      }
    }
  }, [selectedArticle, selectedAccountIds, postDrafts, track]);

  const writeCaptions = useCallback(() => {
    if (!selectedArticle || selectedAccountIds.size === 0) return;
    const accountIds = Array.from(selectedAccountIds);
    const draftsMap = new Map<string, PostDraft>();
    for (const accountId of accountIds) {
      draftsMap.set(accountId, { accountId, caption: '', scheduledAt: getSuggestedTime(), isGenerating: false });
    }
    setPostDrafts(new Map(draftsMap));
  }, [selectedArticle, selectedAccountIds]);

  const regenerateCaption = useCallback(async (accountId: string) => {
    if (!selectedArticle) return;

    setPostDrafts((prev) => {
      const updated = new Map(prev);
      const existing = updated.get(accountId);
      if (existing) updated.set(accountId, { ...existing, isGenerating: true });
      return updated;
    });

    try {
      const res = await fetch('/api/social/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: selectedArticle.id, socialAccountId: accountId }),
      });
      if (!res.ok) throw new Error('Failed');
      const { caption } = await res.json();

      setPostDrafts((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(accountId);
        if (existing) updated.set(accountId, { ...existing, caption, isGenerating: false });
        return updated;
      });
    } catch {
      toast.error('Failed to regenerate caption');
      setPostDrafts((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(accountId);
        if (existing) updated.set(accountId, { ...existing, isGenerating: false });
        return updated;
      });
    }
  }, [selectedArticle]);

  const updateDraftCaption = useCallback((accountId: string, caption: string) => {
    setPostDrafts((prev) => {
      const updated = new Map(prev);
      const existing = updated.get(accountId);
      if (existing) updated.set(accountId, { ...existing, caption });
      return updated;
    });
  }, []);

  const updateDraftSchedule = useCallback((accountId: string, scheduledAt: string) => {
    setPostDrafts((prev) => {
      const updated = new Map(prev);
      const existing = updated.get(accountId);
      if (existing) updated.set(accountId, { ...existing, scheduledAt });
      return updated;
    });
  }, []);

  const removeDraft = useCallback((accountId: string) => {
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
  }, []);

  const queuePosts = useCallback(async () => {
    if (!selectedArticle || postDrafts.size === 0) return;

    const invalid = Array.from(postDrafts.values()).filter((d) => !d.caption.trim() || !d.scheduledAt);
    if (invalid.length > 0) {
      toast.error('Please complete all captions and scheduled times');
      return;
    }

    setIsQueuingPosts(true);
    try {
      const postsPayload = Array.from(postDrafts.values()).map((draft) => ({
        articleId: selectedArticle.id,
        socialAccountId: draft.accountId,
        caption: draft.caption,
        imageUrl: selectedArticle.featuredImage || undefined,
        articleUrl: selectedArticleUrl,
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
      close();
      onPostsQueued();
    } catch {
      toast.error('Failed to queue posts');
    } finally {
      setIsQueuingPosts(false);
    }
  }, [selectedArticle, postDrafts, selectedArticleUrl, close, onPostsQueued]);

  return {
    isOpen,
    step,
    open,
    close,
    goBackToArticle,

    // Articles
    articles: filteredArticles,
    isLoadingArticles,
    articleSearch,
    setArticleSearch,
    selectedArticle,
    selectedArticleUrl,
    setSelectedArticleUrl,
    selectArticle,

    // Accounts
    socialAccounts,
    isLoadingAccounts,
    selectedAccountIds,
    toggleAccount,

    // Drafts
    postDrafts,
    generateCaptions,
    writeCaptions,
    regenerateCaption,
    updateDraftCaption,
    updateDraftSchedule,
    removeDraft,

    // Queue
    isQueuingPosts,
    queuePosts,
  };
}
