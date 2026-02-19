'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import StoryFeedbackModal from './StoryFeedbackModal';
import {
  HiOutlineLightBulb,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineXMark,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineArrowTrendingUp,
  HiOutlineSparkles,
  HiOutlineLink,
  HiOutlineClock,
  HiOutlineShieldCheck,
  HiOutlineQuestionMarkCircle,
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function RelevanceBadge({ score }: { score: number }) {
  if (score >= 70) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30">
        {score}
      </span>
    );
  }
  if (score >= 40) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30">
        {score}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300 dark:bg-ink-700/60 dark:text-ink-400 dark:border-ink-600/40">
      {score}
    </span>
  );
}

function VerificationBadge({ status }: { status: StoryIntelligenceItem['verificationStatus'] }) {
  const configs: Record<string, { label: string; description: string; classes: string; icon: React.ReactNode }> = {
    VERIFIED: {
      label: 'Verified',
      description: 'Strong multi-source corroboration confirms this story',
      classes: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
      icon: <HiOutlineCheckCircle className="w-3 h-3" />,
    },
    PLAUSIBLE: {
      label: 'Plausible',
      description: 'Credible story from 1-2 sources, not yet fully corroborated',
      classes: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
      icon: <HiOutlineShieldCheck className="w-3 h-3" />,
    },
    UNVERIFIED: {
      label: 'Unverified',
      description: 'Sources are unclear or have not been assessed yet',
      classes: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-ink-700/60 dark:text-ink-400 dark:border-ink-600/40',
      icon: <HiOutlineQuestionMarkCircle className="w-3 h-3" />,
    },
    DISPUTED: {
      label: 'Disputed',
      description: 'Conflicting information found across sources',
      classes: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
      icon: <HiOutlineExclamationTriangle className="w-3 h-3" />,
    },
    FLAGGED: {
      label: 'Flagged',
      description: 'Potentially dubious or misleading — needs extra scrutiny',
      classes: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
      icon: <HiOutlineExclamationTriangle className="w-3 h-3" />,
    },
  };
  const cfg = configs[status] ?? configs.UNVERIFIED;
  return (
    <span
      title={cfg.description}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border cursor-help ${cfg.classes}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function StoryCard({ story, onRefresh }: { story: StoryIntelligenceItem; onRefresh: () => void }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [totalRatings, setTotalRatings] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackAction, setFeedbackAction] = useState<'CLAIM_FEEDBACK' | 'DISMISS_FEEDBACK' | null>(null);

  const handleQuickRate = async (rating: 1 | 5) => {
    try {
      await fetch(`/api/story-intelligence/${story.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, tags: [], action: 'QUICK_RATE' }),
      });
      setUserRating(rating);
      setTotalRatings((prev) => prev + 1);
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
      toast.success('Story claimed — training algorithm & opening editor');
      // Remove from feed immediately, then refresh to sync server state
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
      // onRefresh() is called after the modal is closed/submitted
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to dismiss');
      setDismissing(false);
    }
  };

  const isClaimed = !!story.claimedBy || !!story.article;
  const corroborating = story.verificationSources.filter(s => s.corroborates);

  return (
    <div className="rounded-xl bg-slate-800/70 md:bg-white md:dark:bg-ink-900 border border-blue-500/20 md:border-blue-200 md:dark:border-blue-800/60 overflow-hidden">
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <RelevanceBadge score={story.relevanceScore} />
              <VerificationBadge status={story.verificationStatus} />
              {story.velocityScore > 50 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">
                  <HiOutlineArrowTrendingUp className="w-3 h-3" />
                  Trending
                </span>
              )}
              {story.category && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-ink-700/40 md:bg-ink-100 md:dark:bg-ink-800 text-ink-400 md:text-ink-500 md:dark:text-ink-400">
                  {story.category}
                </span>
              )}
            </div>

            {/* Headline */}
            <a
              href={story.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <h4 className="text-sm font-semibold text-white md:text-ink-900 md:dark:text-ink-100 leading-snug group-hover:text-blue-300 md:group-hover:text-blue-700 md:dark:group-hover:text-blue-300 transition-colors">
                {story.headline}
                <HiOutlineArrowTopRightOnSquare className="inline w-3.5 h-3.5 ml-1.5 opacity-50 group-hover:opacity-100 transition-opacity align-middle" />
              </h4>
            </a>

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-white/50 md:text-ink-400">
              <span className="flex items-center gap-1">
                <HiOutlineClock className="w-3.5 h-3.5" />
                {timeAgo(story.firstSeenAt)}
              </span>
              {story.sources.length > 0 && (
                <span className="flex items-center gap-1">
                  <HiOutlineLink className="w-3.5 h-3.5" />
                  {story.sources.length} source{story.sources.length !== 1 ? 's' : ''}
                </span>
              )}
              {corroborating.length > 0 && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                  {corroborating.length} corroborating
                </span>
              )}
              {isClaimed && (
                <span className="text-blue-400">
                  {story.claimedBy ? `Claimed by ${story.claimedBy.name}` : 'Article exists'}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {!isClaimed ? (
              <button
                onClick={handleWrite}
                disabled={claiming}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors active:scale-95"
              >
                {claiming ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <HiOutlineSparkles className="w-3.5 h-3.5" />
                )}
                Write This
              </button>
            ) : story.article ? (
              <button
                onClick={() => router.push(`/editor/${story.article!.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-blue-300 bg-blue-900/30 hover:bg-blue-800/50 border border-blue-700/40 rounded-lg transition-colors active:scale-95"
              >
                View Draft
              </button>
            ) : null}
            <button
              onClick={handleDismiss}
              disabled={dismissing}
              className="flex items-center justify-center gap-1 px-3 py-1.5 text-[12px] text-white/40 md:text-ink-400 hover:text-white/80 md:hover:text-ink-600 hover:bg-white/10 md:hover:bg-ink-100 md:dark:hover:bg-ink-800 rounded-lg disabled:opacity-50 transition-colors"
            >
              {dismissing ? (
                <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <HiOutlineXMark className="w-4 h-4" />
              )}
              Dismiss
            </button>
          </div>
        </div>

        {/* Rating + expand row */}
        <div className="flex items-center mt-3">
          <div className="flex items-center gap-1 mr-auto">
            <button
              onClick={() => handleQuickRate(5)}
              className={`p-1.5 rounded-lg transition-colors ${
                userRating === 5 ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:text-green-500 hover:bg-green-50'
              }`}
              title="Good suggestion"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
            </button>
            <button
              onClick={() => handleQuickRate(1)}
              className={`p-1.5 rounded-lg transition-colors ${
                userRating === 1 ? 'bg-red-100 text-red-600' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
              }`}
              title="Bad suggestion"
            >
              <svg className="w-4 h-4 rotate-180" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
            </button>
            {totalRatings > 0 && (
              <span className="text-xs text-gray-400 ml-1">
                {avgRating?.toFixed(1)} ({totalRatings})
              </span>
            )}
          </div>

          {(story.suggestedAngles?.length || story.verificationNotes || story.verificationSources.length > 0) && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-[11px] text-blue-400/80 hover:text-blue-300 transition-colors"
            >
            {expanded ? (
              <>
                <HiOutlineChevronUp className="w-3.5 h-3.5" />
                Hide details
              </>
            ) : (
              <>
                <HiOutlineChevronDown className="w-3.5 h-3.5" />
                Show details
              </>
            )}
          </button>
        )}
      </div>
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="border-t border-blue-500/10 md:border-blue-200/50 md:dark:border-blue-800/40 px-4 py-3 space-y-3 bg-slate-900/40 md:bg-ink-50/50 md:dark:bg-ink-950/30">
          {/* Suggested Angles */}
          {story.suggestedAngles && story.suggestedAngles.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-white/60 md:text-ink-500 uppercase tracking-wider mb-1.5">
                Suggested Angles
              </p>
              <ul className="space-y-1">
                {story.suggestedAngles.map((angle, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-white/80 md:text-ink-700 md:dark:text-ink-300">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0">&#8250;</span>
                    {angle}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Verification Notes */}
          {story.verificationNotes && (
            <div>
              <p className="text-[11px] font-semibold text-white/60 md:text-ink-500 uppercase tracking-wider mb-1.5">
                Verification Notes
              </p>
              <p className="text-[12px] text-white/70 md:text-ink-600 md:dark:text-ink-400 leading-relaxed">
                {story.verificationNotes}
              </p>
            </div>
          )}

          {/* Corroborating Sources */}
          {story.verificationSources.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-white/60 md:text-ink-500 uppercase tracking-wider mb-1.5">
                Sources
              </p>
              <div className="space-y-1.5">
                {story.verificationSources.map(src => (
                  <div key={src.id} className="flex items-start gap-2">
                    {src.corroborates ? (
                      <HiOutlineCheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <HiOutlineExclamationTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <a
                        href={src.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] font-medium text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {src.sourceName}
                      </a>
                      {src.excerpt && (
                        <p className="text-[11px] text-white/50 md:text-ink-500 mt-0.5 line-clamp-2">
                          {src.excerpt}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
    <div className="space-y-3">
      {sorted.map(story => (
        <StoryCard key={story.id} story={story} onRefresh={onRefresh} />
      ))}
    </div>
  );
}
