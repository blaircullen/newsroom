'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import StoryFeedbackModal from './StoryFeedbackModal';
import {
  HiOutlineLightBulb,
  HiOutlineXMark,
  HiOutlineArrowTrendingUp,
  HiOutlineSparkles,
  HiOutlineArrowTopRightOnSquare,
} from 'react-icons/hi2';

export interface StoryIntelligenceItem {
  id: string;
  headline: string;
  sourceUrl: string;
  sources: Array<{ name: string; url: string }>;
  category: string | null;
  relevanceScore: number;
  velocityScore: number;
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'PLAUSIBLE' | 'DISPUTED' | 'FLAGGED';
  verificationNotes: string | null;
  suggestedAngles: string[] | null;
  alertLevel: string;
  firstSeenAt: string;
  claimedBy: { id: string; name: string } | null;
  article: { id: string; headline: string; status: string } | null;
  verificationSources: Array<{
    id: string;
    sourceName: string;
    sourceUrl: string;
    corroborates: boolean;
    excerpt?: string;
  }>;
}

interface Props {
  stories: StoryIntelligenceItem[];
  onRefresh: () => void;
}

function getSourceLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const isX = host === 'x.com' || host === 'twitter.com';
    if (isX) {
      const account = parsed.pathname.split('/')[1];
      return account || 'X';
    }
    return host.replace(/\.com$|\.org$|\.net$/, '').toUpperCase();
  } catch {
    return url;
  }
}

function StoryCard({ story, onRefresh }: { story: StoryIntelligenceItem; onRefresh: () => void }) {
  const router = useRouter();
  const [claiming, setClaiming] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackAction, setFeedbackAction] = useState<'CLAIM_FEEDBACK' | 'DISMISS_FEEDBACK' | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);

  const isMultiSource = (story.sources?.length || 0) > 1 ||
    story.verificationSources.filter(s => s.corroborates).length > 0;

  // Collect unique source labels for display (up to 3)
  const sourceLabels: Array<{ name: string; url: string }> = [];
  const seenHosts = new Set<string>();

  // Primary source
  const primaryLabel = getSourceLabel(story.sourceUrl);
  seenHosts.add(primaryLabel);
  sourceLabels.push({ name: primaryLabel, url: story.sourceUrl });

  // From story.sources
  if (Array.isArray(story.sources)) {
    for (const s of story.sources) {
      if (sourceLabels.length >= 3) break;
      const label = s.name || getSourceLabel(s.url);
      const normalized = label.toUpperCase();
      if (!seenHosts.has(normalized)) {
        seenHosts.add(normalized);
        sourceLabels.push({ name: label.toUpperCase(), url: s.url });
      }
    }
  }

  // From verification sources
  for (const vs of story.verificationSources.filter(s => s.corroborates)) {
    if (sourceLabels.length >= 3) break;
    const label = vs.sourceName || getSourceLabel(vs.sourceUrl);
    const normalized = label.toUpperCase();
    if (!seenHosts.has(normalized)) {
      seenHosts.add(normalized);
      sourceLabels.push({ name: label.toUpperCase(), url: vs.sourceUrl });
    }
  }

  const handleQuickRate = async (rating: 1 | 5) => {
    try {
      await fetch(`/api/story-intelligence/${story.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, tags: [], action: 'QUICK_RATE' }),
      });
      setUserRating(rating);
    } catch (error) {
      console.error('Failed to submit rating:', error);
    }
  };

  const handleWrite = async () => {
    setClaiming(true);
    try {
      const res = await fetch(`/api/story-intelligence/${story.id}/claim`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to claim story');
      }
      const data = await res.json();
      toast.success('Story claimed — generating article...');
      onRefresh();
      setFeedbackAction('CLAIM_FEEDBACK');
      setShowFeedbackModal(true);
      router.push(`/editor/${data.articleId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to claim story');
      setClaiming(false);
    }
  };

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      const res = await fetch(`/api/story-intelligence/${story.id}/dismiss`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to dismiss');
      }
      setFeedbackAction('DISMISS_FEEDBACK');
      setShowFeedbackModal(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to dismiss');
      setDismissing(false);
    }
  };

  const isClaimed = !!story.claimedBy || !!story.article;

  return (
    <div
      className={`rounded-lg p-4 hover:shadow-md transition-all group relative overflow-hidden ${
        isMultiSource
          ? 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-press-300 dark:border-press-700 ring-1 ring-press-200 dark:ring-press-800'
          : 'bg-white dark:bg-ink-900 border border-blue-200/50 dark:border-blue-800/50'
      }`}
    >
      {/* Dismiss button — always visible */}
      {!isClaimed && (
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className={`absolute z-10 p-1 rounded-full transition-colors ${
            isMultiSource
              ? 'top-8 right-2 text-press-400/60 hover:text-press-600 hover:bg-press-100 dark:hover:bg-press-900'
              : 'top-2 right-2 text-ink-300 hover:text-ink-600 hover:bg-ink-100 dark:text-ink-600 dark:hover:text-ink-400 dark:hover:bg-ink-800'
          }`}
          title="Dismiss story"
        >
          {dismissing ? (
            <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : (
            <HiOutlineXMark className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Multi-source badge */}
      {isMultiSource && (
        <div className="absolute top-0 right-0">
          <div className="bg-gradient-to-r from-press-500 to-orange-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-bl-lg flex items-center gap-1">
            <HiOutlineArrowTrendingUp className="w-3 h-3" />
            Multi-Source
          </div>
        </div>
      )}

      {/* Headline */}
      <h4 className={`text-sm font-medium line-clamp-2 mb-3 leading-snug pr-6 ${
        isMultiSource
          ? 'text-press-900 dark:text-red-100'
          : 'text-ink-800 dark:text-ink-200'
      }`}>
        {story.headline}
      </h4>

      {/* Source labels */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {sourceLabels.map((src, i) => (
          <a
            key={i}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1 text-[11px] hover:underline ${
              isMultiSource
                ? 'text-press-600 dark:text-press-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}
          >
            <span className="uppercase tracking-wider font-medium">{src.name}</span>
            <HiOutlineArrowTopRightOnSquare className="w-2.5 h-2.5" />
          </a>
        ))}
      </div>

      {/* Action row: rating + Write This */}
      <div className="flex items-center justify-between">
        {/* Thumbs up / down rating */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => handleQuickRate(5)}
            disabled={userRating !== null}
            className={`p-1.5 rounded-lg transition-colors disabled:cursor-default ${
              userRating === 5
                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                : userRating !== null
                  ? 'text-ink-200 dark:text-ink-700'
                  : 'text-ink-300 dark:text-ink-600 hover:text-green-500 hover:bg-green-50 dark:hover:text-green-400 dark:hover:bg-green-900/20'
            }`}
            title="Good suggestion"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
            </svg>
          </button>
          <button
            onClick={() => handleQuickRate(1)}
            disabled={userRating !== null}
            className={`p-1.5 rounded-lg transition-colors disabled:cursor-default ${
              userRating === 1
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : userRating !== null
                  ? 'text-ink-200 dark:text-ink-700'
                  : 'text-ink-300 dark:text-ink-600 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20'
            }`}
            title="Bad suggestion"
          >
            <svg className="w-4 h-4 rotate-180" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
            </svg>
          </button>
        </div>

        {/* Write This / View Draft button */}
        {!isClaimed ? (
          <button
            onClick={handleWrite}
            disabled={claiming}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-all active:scale-95 flex-shrink-0 ${
              isMultiSource
                ? 'bg-gradient-to-r from-press-600 to-orange-500 hover:from-press-700 hover:to-orange-600'
                : 'bg-ink-950 dark:bg-ink-700 hover:bg-ink-800 dark:hover:bg-ink-600'
            }`}
          >
            {claiming ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <HiOutlineSparkles className="w-3.5 h-3.5" />
                Write This
              </>
            )}
          </button>
        ) : story.article ? (
          <button
            onClick={() => router.push(`/editor/${story.article!.id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/40 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors active:scale-95 flex-shrink-0"
          >
            View Draft
          </button>
        ) : null}
      </div>

      {showFeedbackModal && feedbackAction && (
        <StoryFeedbackModal
          storyId={story.id}
          headline={story.headline}
          action={feedbackAction}
          onClose={() => {
            setShowFeedbackModal(false);
            if (feedbackAction === 'DISMISS_FEEDBACK') onRefresh();
          }}
          onSubmit={() => {
            setShowFeedbackModal(false);
            if (feedbackAction === 'DISMISS_FEEDBACK') onRefresh();
          }}
        />
      )}
    </div>
  );
}

export default function StoryIntelligenceFeed({ stories, onRefresh }: Props) {
  const sorted = [...stories].sort((a, b) => b.relevanceScore - a.relevanceScore);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <HiOutlineLightBulb className="w-10 h-10 text-white/20 md:text-ink-300 mb-3" />
        <p className="text-sm text-white/60 md:text-ink-500">No story intelligence available</p>
        <p className="text-xs text-white/40 md:text-ink-400 mt-1">Check back soon for AI-scored stories</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {sorted.map(story => (
        <StoryCard key={story.id} story={story} onRefresh={onRefresh} />
      ))}
    </div>
  );
}
