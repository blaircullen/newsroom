'use client';

import { HiOutlineDocumentText, HiOutlineArrowPath, HiOutlineTrash } from 'react-icons/hi2';

interface DraftData {
  headline: string;
  subHeadline: string;
  bodyHtml: string;
  bodyContent: string;
  tags: string[];
  featuredImage: string | null;
  imageCredit: string;
  savedAt: number;
}

interface DraftRecoveryModalProps {
  draft: DraftData;
  onRestore: () => void;
  onDiscard: () => void;
}

export default function DraftRecoveryModal({
  draft,
  onRestore,
  onDiscard,
}: DraftRecoveryModalProps) {
  const savedDate = new Date(draft.savedAt);
  const wordCount = draft.bodyContent?.split(/\s+/).filter(Boolean).length || 0;

  return (
    <div className="fixed inset-0 bg-ink-950/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-700 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-ink-100 dark:border-ink-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center">
              <HiOutlineArrowPath className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">
                Unsaved Draft Found
              </h2>
              <p className="text-sm text-ink-500 dark:text-ink-400">
                Saved {savedDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Content preview */}
        <div className="px-6 py-5">
          <div className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4 mb-4">
            {draft.headline ? (
              <>
                <h3 className="font-display font-semibold text-ink-900 dark:text-white line-clamp-2 mb-2">
                  {draft.headline}
                </h3>
                {draft.subHeadline && (
                  <p className="text-sm text-ink-500 dark:text-ink-400 line-clamp-1 mb-2">
                    {draft.subHeadline}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-ink-400">
                  <span className="flex items-center gap-1">
                    <HiOutlineDocumentText className="w-3.5 h-3.5" />
                    {wordCount} words
                  </span>
                  {draft.tags.length > 0 && (
                    <span>Tags: {draft.tags.slice(0, 3).join(', ')}</span>
                  )}
                  {draft.featuredImage && (
                    <span className="text-emerald-600 dark:text-emerald-400">Has image</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-ink-400 italic">Untitled draft with {wordCount} words</p>
            )}
          </div>

          <p className="text-sm text-ink-600 dark:text-ink-300">
            Would you like to restore this draft or start fresh?
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/50 flex items-center justify-end gap-3">
          <button
            onClick={onDiscard}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink-600 dark:text-ink-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <HiOutlineTrash className="w-4 h-4" />
            Discard Draft
          </button>
          <button
            onClick={onRestore}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-press-600 hover:bg-press-700 rounded-lg transition-colors"
          >
            <HiOutlineArrowPath className="w-4 h-4" />
            Restore Draft
          </button>
        </div>
      </div>
    </div>
  );
}
