'use client';

import { HiOutlinePlusCircle } from 'react-icons/hi2';
import type { ViewTab } from '@/types/social';

interface QueueHeaderProps {
  activeView: ViewTab;
  onViewChange: (view: ViewTab) => void;
  onCreatePost: () => void;
}

const VIEWS: { id: ViewTab; label: string }[] = [
  { id: 'queue', label: 'Queue' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'activity', label: 'Activity' },
];

export default function QueueHeader({
  activeView,
  onViewChange,
  onCreatePost,
}: QueueHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 px-6 py-3">
      {/* Left: Title */}
      <h1 className="font-display font-semibold text-lg text-ink-900 dark:text-ink-100">
        Social Queue
      </h1>

      {/* Center: View Tabs */}
      <div className="flex items-center gap-0.5 bg-ink-100 dark:bg-ink-800 p-0.5 rounded-lg">
        {VIEWS.map((view) => {
          const isActive = activeView === view.id;
          return (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={`
                px-4 py-1.5 text-xs font-semibold rounded-md transition
                ${
                  isActive
                    ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 shadow-sm'
                    : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-400'
                }
              `}
            >
              {view.label}
            </button>
          );
        })}
      </div>

      {/* Right: Create Post Button */}
      <button
        onClick={onCreatePost}
        className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-md transition hover:translate-y-[-1px] hover:shadow-lg"
      >
        <HiOutlinePlusCircle className="w-4 h-4" />
        Create Post
      </button>
    </header>
  );
}
