'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineLink, HiOutlinePaperAirplane } from 'react-icons/hi2';

interface ExemplarSubmitFormProps {
  onSubmitted: () => void;
}

export default function ExemplarSubmitForm({ onSubmitted }: ExemplarSubmitFormProps) {
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/exemplars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl, notes: notes.trim() || undefined }),
      });

      if (res.status === 409) {
        toast.error('This URL has already been submitted.');
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        toast.error(data.error ?? 'Failed to submit URL.');
        return;
      }

      toast.success('Exemplar submitted — analysis in progress.');
      setUrl('');
      setNotes('');
      setShowNotes(false);
      onSubmitted();
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-700 p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* URL input */}
        <div className="flex items-center gap-2 rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-3 py-2.5 focus-within:ring-2 focus-within:ring-violet-500/40 focus-within:border-violet-400 dark:focus-within:border-violet-500 transition-all">
          <HiOutlineLink className="w-4 h-4 text-ink-400 dark:text-ink-500 flex-shrink-0" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste article URL..."
            required
            disabled={isSubmitting}
            className="flex-1 bg-transparent text-sm text-ink-900 dark:text-ink-100 placeholder-ink-400 dark:placeholder-ink-500 outline-none disabled:opacity-60"
          />
        </div>

        {/* Notes toggle + textarea */}
        {!showNotes ? (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
          >
            + Add notes
          </button>
        ) : (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about why this exemplar is useful..."
            rows={3}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-3 py-2 text-sm text-ink-900 dark:text-ink-100 placeholder-ink-400 dark:placeholder-ink-500 outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 dark:focus:border-violet-500 transition-all resize-none disabled:opacity-60"
          />
        )}

        {/* Submit button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !url.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 dark:disabled:bg-violet-800 text-white text-sm font-medium transition-colors disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <HiOutlinePaperAirplane className="w-4 h-4" />
                Submit
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
