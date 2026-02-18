'use client';

import { useState } from 'react';
import { HiOutlineXMark } from 'react-icons/hi2';

interface StoryFeedbackModalProps {
  storyId: string;
  headline: string;
  action: 'CLAIM_FEEDBACK' | 'DISMISS_FEEDBACK';
  onClose: () => void;
  onSubmit: () => void;
}

const POSITIVE_TAGS = [
  { value: 'GREAT_ANGLE', label: 'Great angle' },
  { value: 'TIMELY', label: 'Timely' },
  { value: 'WOULD_GO_VIRAL', label: 'Would go viral' },
  { value: 'AUDIENCE_MATCH', label: 'Audience match' },
  { value: 'UNDERREPORTED', label: 'Underreported' },
];

const NEGATIVE_TAGS = [
  { value: 'WRONG_AUDIENCE', label: 'Wrong audience' },
  { value: 'ALREADY_COVERED', label: 'Already covered' },
  { value: 'TIMING_OFF', label: 'Timing off' },
  { value: 'LOW_QUALITY_SOURCE', label: 'Low quality source' },
  { value: 'NOT_NEWSWORTHY', label: 'Not newsworthy' },
  { value: 'CLICKBAIT', label: 'Clickbait' },
];

export default function StoryFeedbackModal({
  storyId,
  headline,
  action,
  onClose,
  onSubmit,
}: StoryFeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isClaim = action === 'CLAIM_FEEDBACK';
  const tags = isClaim ? POSITIVE_TAGS : NEGATIVE_TAGS;
  const title = isClaim ? 'How good is this story?' : 'Why dismiss this?';

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await fetch(`/api/story-intelligence/${storyId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, tags: selectedTags, action }),
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setSubmitting(false);
      onSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative w-full sm:max-w-md mx-auto bg-ink-900 border border-ink-700 rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up sm:animate-none">
        {/* Header */}
        <div className="flex items-start justify-between p-4 pb-3 border-b border-ink-800">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-0.5">
              {title}
            </p>
            <p className="text-sm text-ink-200 leading-snug line-clamp-2">{headline}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-500 hover:text-ink-300 hover:bg-ink-800 transition-colors flex-shrink-0"
          >
            <HiOutlineXMark className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Star rating */}
          <div>
            <p className="text-xs text-ink-400 mb-2">Rating</p>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110 active:scale-95"
                  aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                >
                  <svg
                    className={`w-7 h-7 transition-colors ${
                      star <= (hoverRating || rating)
                        ? 'text-amber-400'
                        : 'text-ink-700'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-1 text-xs text-ink-400">
                  {rating === 1 && 'Poor'}
                  {rating === 2 && 'Fair'}
                  {rating === 3 && 'Good'}
                  {rating === 4 && 'Great'}
                  {rating === 5 && 'Excellent'}
                </span>
              )}
            </div>
          </div>

          {/* Tag chips */}
          <div>
            <p className="text-xs text-ink-400 mb-2">Tags (optional)</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const active = selectedTags.includes(tag.value);
                return (
                  <button
                    key={tag.value}
                    onClick={() => toggleTag(tag.value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? isClaim
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-red-500/20 text-red-300 border-red-500/40'
                        : 'bg-ink-800 text-ink-400 border-ink-700 hover:border-ink-500 hover:text-ink-300'
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 pb-5 sm:pb-4">
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="flex-1 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit feedback'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-ink-400 hover:text-ink-200 hover:bg-ink-800 rounded-lg transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
