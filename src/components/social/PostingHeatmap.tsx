'use client';

import { useState } from 'react';
import type { PostingProfile } from '@/lib/optimal-timing';

interface PostingHeatmapProps {
  profile: PostingProfile;
  compact?: boolean;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return '12a';
  if (i < 12) return `${i}a`;
  if (i === 12) return '12p';
  return `${i - 12}p`;
});

function getScoreColor(score: number): string {
  if (score === 0) return 'bg-ink-100 dark:bg-ink-800';
  if (score < 25) return 'bg-red-200 dark:bg-red-900/50';
  if (score < 50) return 'bg-orange-200 dark:bg-orange-900/50';
  if (score < 75) return 'bg-yellow-200 dark:bg-yellow-900/40';
  return 'bg-emerald-300 dark:bg-emerald-800/70';
}

export default function PostingHeatmap({ profile, compact = false }: PostingHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ day: number; hour: number; score: number; x: number; y: number } | null>(null);

  const cellSize = compact ? 'w-3 h-3' : 'w-4 h-4';
  const fontSize = compact ? 'text-[9px]' : 'text-[10px]';

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className={`${fontSize} text-ink-400 font-normal text-right pr-1.5 w-8`} />
              {HOUR_LABELS.map((label, i) => (
                <th
                  key={i}
                  className={`${fontSize} text-ink-400 font-normal px-0 pb-0.5 ${i % 3 === 0 ? '' : 'hidden'}`}
                  colSpan={i % 3 === 0 ? 3 : undefined}
                >
                  {i % 3 === 0 ? label : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_LABELS.map((day, d) => (
              <tr key={d}>
                <td className={`${fontSize} text-ink-400 font-normal text-right pr-1.5 py-0`}>
                  {day}
                </td>
                {Array.from({ length: 24 }, (_, h) => {
                  const score = profile.weeklyScores[d]?.[h] ?? 0;
                  return (
                    <td key={h} className="p-[1px]">
                      <div
                        className={`${cellSize} rounded-sm ${getScoreColor(score)} cursor-pointer transition-opacity hover:opacity-80`}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ day: d, hour: h, score, x: rect.left, y: rect.top });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 rounded-md bg-ink-900 dark:bg-ink-700 text-white text-xs shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 30,
            transform: 'translateX(-50%)',
          }}
        >
          {DAY_LABELS[tooltip.day]} {tooltip.hour === 0 ? '12' : tooltip.hour > 12 ? tooltip.hour - 12 : tooltip.hour}
          {tooltip.hour < 12 ? ' AM' : ' PM'}: Score {tooltip.score}
        </div>
      )}

      {/* Legend */}
      {!compact && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-ink-400">Low</span>
          <div className="flex gap-0.5">
            <div className="w-3 h-3 rounded-sm bg-ink-100 dark:bg-ink-800" />
            <div className="w-3 h-3 rounded-sm bg-red-200 dark:bg-red-900/50" />
            <div className="w-3 h-3 rounded-sm bg-orange-200 dark:bg-orange-900/50" />
            <div className="w-3 h-3 rounded-sm bg-yellow-200 dark:bg-yellow-900/40" />
            <div className="w-3 h-3 rounded-sm bg-emerald-300 dark:bg-emerald-800/70" />
          </div>
          <span className="text-[10px] text-ink-400">High</span>
          <span className="text-[10px] text-ink-300 ml-2">
            (All times ET)
          </span>
        </div>
      )}
    </div>
  );
}
