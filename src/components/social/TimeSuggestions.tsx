'use client';

import { useMemo } from 'react';
import { HiOutlineStar } from 'react-icons/hi2';
import { toET } from '@/lib/date-utils';
import type { PostingProfile } from '@/lib/optimal-timing';

interface TimeSuggestionsProps {
  profile: PostingProfile;
  onSelectTime: (isoString: string) => void;
  selectedTime?: string;
}

function formatSlotLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const slotET = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const todayDate = today.toDateString();
  const tomorrowDate = new Date(today.getTime() + 86400000).toDateString();
  const slotDate = slotET.toDateString();

  let dayLabel: string;
  if (slotDate === todayDate) {
    dayLabel = 'Today';
  } else if (slotDate === tomorrowDate) {
    dayLabel = 'Tomorrow';
  } else {
    dayLabel = slotET.toLocaleDateString('en-US', { weekday: 'short' });
  }

  const timeLabel = slotET.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${dayLabel} ${timeLabel}`;
}

function getStars(score: number): number {
  if (score >= 80) return 3;
  if (score >= 50) return 2;
  return 1;
}

export default function TimeSuggestions({ profile, onSelectTime, selectedTime }: TimeSuggestionsProps) {
  const suggestions = useMemo(() => {
    const now = new Date();
    const candidates: { date: Date; score: number; label: string }[] = [];

    for (let hoursAhead = 1; hoursAhead <= 48; hoursAhead++) {
      const candidate = new Date(now.getTime() + hoursAhead * 3600 * 1000);
      candidate.setMinutes(0, 0, 0);

      const { dayOfWeek, hour } = toET(candidate);
      const score = profile.weeklyScores[dayOfWeek]?.[hour] ?? 0;
      if (score > 0) {
        candidates.push({
          date: candidate,
          score,
          label: formatSlotLabel(candidate),
        });
      }
    }

    // Deduplicate by label
    const seen = new Set<string>();
    const unique = candidates.filter(c => {
      if (seen.has(c.label)) return false;
      seen.add(c.label);
      return true;
    });

    // Sort by score, take top 8
    unique.sort((a, b) => b.score - a.score);
    const top = unique.slice(0, 8);

    // Sort chronologically
    top.sort((a, b) => a.date.getTime() - b.date.getTime());

    return top;
  }, [profile]);

  if (suggestions.length === 0) return null;

  return (
    <div className="mb-3">
      <p className="text-xs font-medium text-ink-500 dark:text-ink-400 mb-2">
        Suggested times (ET)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((slot) => {
          const stars = getStars(slot.score);
          const isoValue = slot.date.toISOString().slice(0, 16);
          const isSelected = selectedTime === isoValue;

          return (
            <button
              key={slot.label}
              type="button"
              onClick={() => onSelectTime(isoValue)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-press-600 text-white ring-2 ring-press-300'
                  : 'bg-ink-50 dark:bg-ink-800 text-ink-700 dark:text-ink-300 hover:bg-press-50 dark:hover:bg-ink-700 hover:text-press-700 dark:hover:text-press-300 border border-ink-200 dark:border-ink-700'
              }`}
              title={`Score: ${slot.score}/100`}
            >
              <span>{slot.label}</span>
              <span className="flex">
                {Array.from({ length: stars }).map((_, i) => (
                  <HiOutlineStar
                    key={i}
                    className={`w-3 h-3 ${isSelected ? 'text-yellow-200' : 'text-yellow-500'}`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
