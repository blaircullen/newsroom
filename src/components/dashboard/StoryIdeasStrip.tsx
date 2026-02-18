'use client';

import { HiOutlineLightBulb, HiOutlineXMark } from 'react-icons/hi2';
import type { StoryIdea } from './HotSection';

interface StoryIdeasStripProps {
  ideas: StoryIdea[];
  onDismiss: (headline: string) => void;
  onDraftIt: (headline: string) => void;
  isCreating?: string | null;
}

export default function StoryIdeasStrip({ ideas, onDismiss, onDraftIt, isCreating }: StoryIdeasStripProps) {
  if (ideas.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="terminal-label text-paper-400">Story Ideas</h2>
        <HiOutlineLightBulb className="w-4 h-4 text-amber-400" />
        <span className="text-xs text-paper-500 font-mono">{ideas.length}</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {ideas.map((idea) => (
          <div
            key={idea.headline}
            className="shrink-0 w-[280px] bg-ink-900 rounded-lg border border-ink-800 p-4 hover:border-ink-600 transition-all duration-150"
          >
            <p className="text-sm text-paper-200 font-medium line-clamp-2 mb-2">
              {idea.headline}
            </p>
            {idea.source && (
              <p className="text-xs text-paper-500 mb-3">{idea.source}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onDraftIt(idea.headline)}
                disabled={isCreating === idea.headline}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-press-400 bg-press-500/10 rounded-md hover:bg-press-500/20 transition-colors duration-150 disabled:opacity-50"
              >
                {isCreating === idea.headline ? 'Creating...' : 'Draft It \u2192'}
              </button>
              <button
                onClick={() => onDismiss(idea.headline)}
                className="p-1.5 text-paper-500 hover:text-paper-300 rounded-md hover:bg-ink-800 transition-colors duration-150"
                title="Dismiss"
              >
                <HiOutlineXMark className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
