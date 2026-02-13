'use client';

import { useState, useMemo } from 'react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import type { SocialPostData } from '@/types/social';

interface CalendarViewProps {
  posts: SocialPostData[];
}

interface DayCell {
  date: Date;
  isToday: boolean;
  posts: SocialPostData[];
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday is start of week
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/New_York' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/New_York' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} — ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} — ${endMonth} ${endDay}, ${year}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getPostDate(post: SocialPostData): Date {
  // Parse in ET timezone
  const date = new Date(post.scheduledAt);
  return date;
}

export default function CalendarView({ posts }: CalendarViewProps) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // Generate week days
  const weekDays = useMemo((): DayCell[] => {
    const days: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      days.push({
        date,
        isToday: isSameDay(date, today),
        posts: [],
      });
    }

    // Group posts by day
    posts.forEach((post) => {
      const postDate = getPostDate(post);
      const dayCell = days.find((d) => isSameDay(d.date, postDate));
      if (dayCell) {
        dayCell.posts.push(post);
      }
    });

    return days;
  }, [weekStart, posts, today]);

  const goToPrevWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const getStatusDots = (dayPosts: SocialPostData[]) => {
    const counts = {
      FAILED: 0,
      PENDING: 0,
      APPROVED: 0,
      SENT: 0,
      SENDING: 0,
    };

    dayPosts.forEach((post) => {
      if (post.status in counts) {
        counts[post.status]++;
      }
    });

    const dots: { type: 'FAILED' | 'PENDING' | 'APPROVED' | 'SENT'; count: number }[] = [];
    if (counts.FAILED > 0) dots.push({ type: 'FAILED', count: counts.FAILED });
    if (counts.PENDING > 0) dots.push({ type: 'PENDING', count: counts.PENDING });
    if (counts.APPROVED > 0) dots.push({ type: 'APPROVED', count: counts.APPROVED });
    if (counts.SENT > 0) dots.push({ type: 'SENT', count: counts.SENT });

    return dots;
  };

  const getDotColor = (type: 'FAILED' | 'PENDING' | 'APPROVED' | 'SENT') => {
    switch (type) {
      case 'FAILED':
        return 'bg-red-500/70';
      case 'PENDING':
        return 'bg-amber-500/60';
      case 'APPROVED':
        return 'bg-blue-500/60';
      case 'SENT':
        return 'bg-emerald-500/40';
      default:
        return 'bg-ink-300';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Week Navigation */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={goToPrevWeek}
          className="w-8 h-8 border border-ink-200 dark:border-ink-700 rounded-md flex items-center justify-center hover:bg-ink-50 dark:hover:bg-ink-800 transition"
        >
          <HiChevronLeft className="w-4 h-4 text-ink-600 dark:text-ink-400" />
        </button>
        <h2 className="font-display text-base font-semibold text-ink-900 dark:text-ink-100">
          {formatWeekRange(weekStart)}
        </h2>
        <button
          onClick={goToNextWeek}
          className="w-8 h-8 border border-ink-200 dark:border-ink-700 rounded-md flex items-center justify-center hover:bg-ink-50 dark:hover:bg-ink-800 transition"
        >
          <HiChevronRight className="w-4 h-4 text-ink-600 dark:text-ink-400" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden rounded-xl border border-ink-200 dark:border-ink-700 bg-ink-200 dark:bg-ink-700" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
        {/* Day Headers */}
        {DAY_NAMES.map((dayName) => (
          <div
            key={dayName}
            className="bg-ink-50 dark:bg-ink-800/50 px-2 py-2 text-center"
          >
            <span className="font-mono text-[11px] uppercase text-ink-500 dark:text-ink-400 font-semibold">
              {dayName}
            </span>
          </div>
        ))}

        {/* Day Cells */}
        {weekDays.map((day) => {
          const dots = getStatusDots(day.posts);
          return (
            <div
              key={day.date.toISOString()}
              className={`min-h-[110px] p-2 ${
                day.isToday
                  ? 'bg-red-50/50 dark:bg-red-950/10'
                  : 'bg-white dark:bg-ink-900'
              }`}
            >
              {/* Date Number */}
              <div className="mb-2">
                {day.isToday ? (
                  <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white font-mono text-xs font-bold">
                    {day.date.getDate()}
                  </div>
                ) : (
                  <span className="font-mono text-xs text-ink-500 dark:text-ink-400">
                    {day.date.getDate()}
                  </span>
                )}
              </div>

              {/* Status Dots */}
              <div className="flex flex-wrap gap-1">
                {dots.map((dot, idx) => (
                  <div
                    key={idx}
                    className={`h-6 rounded-full flex items-center justify-center px-2 ${getDotColor(dot.type)}`}
                  >
                    <span className="text-[10px] font-mono font-semibold text-white">
                      {dot.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
