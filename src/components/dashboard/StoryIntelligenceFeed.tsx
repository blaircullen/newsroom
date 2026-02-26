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
  HiOutlineHandThumbUp,
  HiOutlineHandThumbDown,
  HiHandThumbUp,
  HiHandThumbDown,
  HiOutlineNewspaper,
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

function StoryCard({ story, onRefresh, onPreview }: { story: StoryIntelligenceItem; onRefresh: () => void; onPreview: (story: StoryIntelligenceItem) => void }) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackAction, setFeedbackAction] = useState<'CLAIM_FEEDBACK' | 'DISMISS_FEEDBACK' | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);

  const isMultiSource = (story.sources?.length || 0) > 1 ||
    story.verificationSources.filter(s => s.corroborates).length > 0;

  // Collect unique source labels for display (up to 3)
  const sourceLabels: Array<{ name: string; url: string }> = [];
  const seenHosts = new Set<string>();
  const normalizeKey = (s: string) => s.toUpperCase().replace(/^@/, '');

  // Primary source
  const primaryLabel = getSourceLabel(story.sourceUrl);
  const primaryNormalized = normalizeKey(primaryLabel);
  seenHosts.add(primaryNormalized);
  sourceLabels.push({ name: primaryLabel.toUpperCase(), url: story.sourceUrl });

  // From story.sources
  if (Array.isArray(story.sources)) {
    for (const s of story.sources) {
      if (sourceLabels.length >= 3) break;
      const label = s.name || getSourceLabel(s.url);
      const normalized = normalizeKey(label);
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
    const normalized = normalizeKey(label);
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

  const handleWrite = () => {
    onPreview(story);
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
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleQuickRate(5)}
            disabled={userRating !== null}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors disabled:cursor-default border ${
              userRating === 5
                ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-700'
                : userRating !== null
                  ? 'text-ink-300 border-transparent dark:text-ink-700'
                  : 'text-ink-500 border-ink-200 dark:text-ink-400 dark:border-ink-700 hover:text-green-600 hover:bg-green-50 hover:border-green-300 dark:hover:text-green-400 dark:hover:bg-green-900/20 dark:hover:border-green-700'
            }`}
            title="Good suggestion"
          >
            {userRating === 5 ? <HiHandThumbUp className="w-3.5 h-3.5" /> : <HiOutlineHandThumbUp className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => handleQuickRate(1)}
            disabled={userRating !== null}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors disabled:cursor-default border ${
              userRating === 1
                ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700'
                : userRating !== null
                  ? 'text-ink-300 border-transparent dark:text-ink-700'
                  : 'text-ink-500 border-ink-200 dark:text-ink-400 dark:border-ink-700 hover:text-red-600 hover:bg-red-50 hover:border-red-300 dark:hover:text-red-400 dark:hover:bg-red-900/20 dark:hover:border-red-700'
            }`}
            title="Bad suggestion"
          >
            {userRating === 1 ? <HiHandThumbDown className="w-3.5 h-3.5" /> : <HiOutlineHandThumbDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Write This / View Draft button */}
        {!isClaimed ? (
          <button
            onClick={handleWrite}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-all active:scale-95 flex-shrink-0 ${
              isMultiSource
                ? 'bg-gradient-to-r from-press-600 to-orange-500 hover:from-press-700 hover:to-orange-600'
                : 'bg-ink-950 dark:bg-ink-700 hover:bg-ink-800 dark:hover:bg-ink-600'
            }`}
          >
            <HiOutlineSparkles className="w-3.5 h-3.5" />
            Write This
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
  const router = useRouter();
  const sorted = [...stories].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const [previewStory, setPreviewStory] = useState<StoryIntelligenceItem | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaim = async () => {
    if (!previewStory) return;
    setIsClaiming(true);
    try {
      const res = await fetch(`/api/story-intelligence/${previewStory.id}/claim`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to claim story');
      }
      const data = await res.json();
      toast.success('Story claimed — generating article...');
      setPreviewStory(null);
      onRefresh();
      router.push(`/editor/${data.articleId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to claim story');
    } finally {
      setIsClaiming(false);
    }
  };

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <HiOutlineLightBulb className="w-10 h-10 text-white/20 md:text-ink-300 mb-3" />
        <p className="text-sm text-white/60 md:text-ink-500">No story intelligence available</p>
        <p className="text-xs text-white/40 md:text-ink-400 mt-1">Check back soon for AI-scored stories</p>
      </div>
    );
  }

  // Collect unique source URLs for a story
  const getPreviewSources = (story: StoryIntelligenceItem) => {
    const seen = new Set<string>();
    const urls: string[] = [];
    if (story.sourceUrl) {
      seen.add(story.sourceUrl);
      urls.push(story.sourceUrl);
    }
    for (const s of story.sources || []) {
      if (s.url && !seen.has(s.url)) {
        seen.add(s.url);
        urls.push(s.url);
      }
    }
    return urls.slice(0, 3);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {sorted.map(story => (
          <StoryCard key={story.id} story={story} onRefresh={onRefresh} onPreview={setPreviewStory} />
        ))}
      </div>

      {/* Preview modal */}
      {previewStory !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="bg-ink-900 border border-ink-700 rounded-2xl max-w-lg w-full mx-4 p-6 shadow-elevated"
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-preview-title"
          >
            {/* Icon + headline */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-press-900/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                <HiOutlineNewspaper className="w-5 h-5 text-press-400" />
              </div>
              <h3
                id="story-preview-title"
                className="text-white font-display font-semibold text-lg leading-snug"
              >
                {previewStory.headline}
              </h3>
            </div>

            {/* Sources */}
            {getPreviewSources(previewStory).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {getPreviewSources(previewStory).map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-ink-400 hover:text-ink-200 transition-colors"
                    title={url}
                  >
                    <span className="truncate max-w-[200px]">{url}</span>
                    <HiOutlineArrowTopRightOnSquare className="w-2.5 h-2.5 flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}

            {/* Score */}
            {previewStory.relevanceScore > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-ink-500">Relevance</span>
                <span className="text-xs font-semibold text-press-400">
                  {Math.round(previewStory.relevanceScore)}
                </span>
                {previewStory.velocityScore > 0 && (
                  <>
                    <span className="text-xs text-ink-600">·</span>
                    <span className="text-xs text-ink-500">Velocity</span>
                    <span className="text-xs font-semibold text-orange-400">
                      {Math.round(previewStory.velocityScore)}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Suggested angles as summary */}
            {previewStory.suggestedAngles && previewStory.suggestedAngles.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-medium text-ink-500 mb-1.5">Suggested angles</p>
                <ul className="space-y-1">
                  {previewStory.suggestedAngles.slice(0, 4).map((angle, i) => (
                    <li key={i} className="text-sm text-ink-300 line-clamp-1">
                      <span className="text-ink-600 mr-1.5">-</span>{angle}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Verification notes as description fallback */}
            {!previewStory.suggestedAngles?.length && previewStory.verificationNotes && (
              <p className="text-sm text-ink-300 line-clamp-4 mb-5">
                {previewStory.verificationNotes}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPreviewStory(null)}
                className="px-4 py-2.5 text-sm font-medium text-ink-400 hover:text-ink-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClaim}
                disabled={isClaiming}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-press-600 hover:bg-press-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all active:scale-95"
              >
                {isClaiming ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <HiOutlineSparkles className="w-3.5 h-3.5" />
                    Generate Article
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
