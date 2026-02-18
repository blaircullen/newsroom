'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PublishingInsights from '@/components/calendar/PublishingInsights';
import { useTrack } from '@/hooks/useTrack';
import { useUIVersion } from '@/contexts/UIVersionContext';
import { etDateString } from '@/lib/date-utils';
import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineClock,
  HiOutlineGlobeAlt,
  HiOutlineChevronDown,
  HiOutlineSignal,
  HiOutlinePlusCircle,
} from 'react-icons/hi2';

interface CalendarArticle {
  id: string;
  headline: string;
  status: string;
  publishedAt: string | null;
  scheduledPublishAt: string | null;
  author: { name: string };
}

interface Week {
  days: Date[];
  type: 'current' | 'content' | 'empty';
  index: number;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatArticleTime(article: CalendarArticle): string | null {
  const dateStr = article.publishedAt || article.scheduledPublishAt;
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      timeZone: 'America/New_York',
      hour12: true,
    });
  } catch {
    return null;
  }
}

export default function CalendarPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const track = useTrack('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [articles, setArticles] = useState<CalendarArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedMobileWeeks, setExpandedMobileWeeks] = useState<Set<number>>(new Set());

  // MC-specific state
  const { uiVersion } = useUIVersion();
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay()); // Sunday
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'EDITOR';

  // Get calendar dates
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    const days: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return { days, year, month, firstDay, lastDay };
  }, [currentDate]);

  // Fetch articles
  useEffect(() => {
    if (!isAdmin) {
      router.push('/dashboard');
      return;
    }

    const fetchArticles = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/articles?limit=500');
        const data = await res.json();
        setArticles(data.articles || []);
      } catch (error) {
        console.error('Failed to fetch articles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticles();
  }, [isAdmin, router]);

  // Index articles by date for O(1) lookup instead of O(n) per date
  const articlesByDate = useMemo(() => {
    const map = new Map<string, CalendarArticle[]>();
    const addToDate = (key: string, article: CalendarArticle) => {
      const arr = map.get(key);
      if (arr) arr.push(article);
      else map.set(key, [article]);
    };
    for (const a of articles) {
      const pubKey = a.publishedAt ? etDateString(new Date(a.publishedAt)) : null;
      const schedKey = a.scheduledPublishAt ? etDateString(new Date(a.scheduledPublishAt)) : null;
      if (pubKey) addToDate(pubKey, a);
      if (schedKey && schedKey !== pubKey) addToDate(schedKey, a);
    }
    return map;
  }, [articles]);

  const getArticlesForDate = useCallback((date: Date) => {
    return articlesByDate.get(etDateString(date)) ?? [];
  }, [articlesByDate]);

  // Group days into weeks with classification
  const weeks = useMemo(() => {
    const result: Week[] = [];
    const todayStr = etDateString(new Date());

    for (let i = 0; i < calendarData.days.length; i += 7) {
      const weekDays = calendarData.days.slice(i, i + 7);
      const isCurrentWeek = weekDays.some(d => etDateString(d) === todayStr);
      const hasContent = weekDays.some(d => getArticlesForDate(d).length > 0);

      let type: 'current' | 'content' | 'empty';
      if (isCurrentWeek) type = 'current';
      else if (hasContent) type = 'content';
      else type = 'empty';

      result.push({ days: weekDays, type, index: result.length });
    }

    // Trim trailing empty weeks (but keep at least one week for empty months)
    while (result.length > 1 && result[result.length - 1].type === 'empty') {
      result.pop();
    }

    return result;
  }, [calendarData.days, getArticlesForDate]);

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
    setExpandedDates(new Set());
    setExpandedMobileWeeks(new Set());
    track('calendar', 'navigate_month', { direction });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setExpandedDates(new Set());
    setExpandedMobileWeeks(new Set());
    const now = new Date();
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    setCurrentWeekStart(d);
    track('calendar', 'go_today');
  };

  const todayStr = useMemo(() => etDateString(new Date()), []);
  const isToday = (date: Date) => etDateString(date) === todayStr;
  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();

  const formatWeekRange = (week: Week) => {
    const first = week.days[0];
    const last = week.days[6];
    const fMonth = first.toLocaleDateString('en-US', { month: 'short' });
    const lMonth = last.toLocaleDateString('en-US', { month: 'short' });
    if (fMonth === lMonth) {
      return `${fMonth} ${first.getDate()}\u2013${last.getDate()}`;
    }
    return `${fMonth} ${first.getDate()} \u2013 ${lMonth} ${last.getDate()}`;
  };

  const getWeekArticleCount = (week: Week) => {
    return week.days.reduce((sum, d) => sum + getArticlesForDate(d).length, 0);
  };

  if (!isAdmin) return null;

  // Article badge for current week (left border style, more detail)
  const renderCurrentWeekArticle = (article: CalendarArticle) => {
    const time = formatArticleTime(article);
    const borderColor = article.status === 'PUBLISHED'
      ? 'border-emerald-400 dark:border-emerald-500'
      : article.status === 'APPROVED'
      ? 'border-blue-400 dark:border-blue-500'
      : 'border-amber-400 dark:border-amber-500';
    const iconColor = article.status === 'PUBLISHED'
      ? 'text-emerald-500 dark:text-emerald-400'
      : article.status === 'APPROVED'
      ? 'text-blue-500 dark:text-blue-400'
      : 'text-amber-500 dark:text-amber-400';

    return (
      <Link
        key={article.id}
        href={`/editor/${article.id}`}
        className={`block pl-2 py-1 border-l-2 ${borderColor} text-xs hover:bg-ink-50 dark:hover:bg-ink-800 rounded-r transition-colors`}
      >
        <span className="line-clamp-2">
          <span className={iconColor}>
            {article.status === 'PUBLISHED' ? (
              <HiOutlineGlobeAlt className="inline w-3 h-3 mr-1" />
            ) : article.scheduledPublishAt ? (
              <HiOutlineClock className="inline w-3 h-3 mr-1" />
            ) : null}
          </span>
          <span className="text-ink-900 dark:text-white">{article.headline}</span>
          {time && (
            <span className="text-ink-400 dark:text-ink-500 ml-1 text-[10px]">{time}</span>
          )}
        </span>
      </Link>
    );
  };

  // Article badge for past weeks (compact full-bg style)
  const renderCompactArticle = (article: CalendarArticle) => (
    <Link
      key={article.id}
      href={`/editor/${article.id}`}
      className={`block px-2 py-1 rounded text-xs truncate transition-colors ${
        article.status === 'PUBLISHED'
          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
          : article.status === 'APPROVED'
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
      }`}
    >
      {article.scheduledPublishAt && article.status !== 'PUBLISHED' && (
        <HiOutlineClock className="inline w-3 h-3 mr-1" />
      )}
      {article.status === 'PUBLISHED' && (
        <HiOutlineGlobeAlt className="inline w-3 h-3 mr-1" />
      )}
      {article.headline}
    </Link>
  );

  const toggleDateExpand = (dateKey: string) => {
    const next = new Set(expandedDates);
    if (next.has(dateKey)) next.delete(dateKey);
    else next.add(dateKey);
    setExpandedDates(next);
  };

  const toggleMobileWeek = (weekIndex: number) => {
    const next = new Set(expandedMobileWeeks);
    if (next.has(weekIndex)) next.delete(weekIndex);
    else next.add(weekIndex);
    setExpandedMobileWeeks(next);
  };

  // ─── Mission Control branch ──────────────────────────────────────────────────
  if (uiVersion === 'mission-control') {
    // Week days for current week view
    const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });

    const navigateWeek = (direction: number) => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + direction * 7);
      setCurrentWeekStart(d);
    };

    const weekRangeLabel = (() => {
      const first = weekDays[0];
      const last = weekDays[6];
      const fMon = first.toLocaleDateString('en-US', { month: 'short' });
      const lMon = last.toLocaleDateString('en-US', { month: 'short' });
      if (fMon === lMon) {
        return `${fMon} ${first.getDate()}\u2013${last.getDate()}, ${first.getFullYear()}`;
      }
      return `${fMon} ${first.getDate()} \u2013 ${lMon} ${last.getDate()}, ${last.getFullYear()}`;
    })();

    // Pipeline summary counts
    const published = articles.filter(a => a.status === 'PUBLISHED').length;
    const scheduled = articles.filter(a => a.status === 'APPROVED' || (a.scheduledPublishAt && a.status !== 'PUBLISHED')).length;
    const drafts = articles.filter(a => a.status === 'DRAFT' || a.status === 'SUBMITTED' || a.status === 'REVISION_REQUESTED').length;
    const total = articles.length;
    const publishedRatio = total > 0 ? published / total : 0;

    // MC article card (dark themed) for week view
    const renderMCCard = (article: CalendarArticle) => {
      const time = formatArticleTime(article);
      const borderColor =
        article.status === 'PUBLISHED'
          ? 'border-l-[#22C55E]'
          : article.status === 'APPROVED' || article.scheduledPublishAt
          ? 'border-l-blue-400'
          : 'border-l-amber-400';
      const statusDot =
        article.status === 'PUBLISHED'
          ? 'bg-[#22C55E]'
          : article.status === 'APPROVED' || article.scheduledPublishAt
          ? 'bg-blue-400'
          : 'bg-amber-400';

      return (
        <Link
          key={article.id}
          href={`/editor/${article.id}`}
          className={`block bg-ink-800 rounded border-l-2 ${borderColor} px-2 py-1.5 hover:bg-ink-700 transition-colors group`}
        >
          <div className="flex items-start gap-1.5">
            <span className={`mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-paper-100 leading-tight line-clamp-1 group-hover:text-white transition-colors">
                {article.headline}
              </p>
              {time && (
                <p className="text-[10px] font-mono text-ink-400 mt-0.5">{time}</p>
              )}
            </div>
          </div>
        </Link>
      );
    };

    // MC month grid article pill
    const renderMCMonthPill = (article: CalendarArticle) => {
      const borderColor =
        article.status === 'PUBLISHED'
          ? 'border-l-[#22C55E]'
          : article.status === 'APPROVED' || article.scheduledPublishAt
          ? 'border-l-blue-400'
          : 'border-l-amber-400';

      return (
        <Link
          key={article.id}
          href={`/editor/${article.id}`}
          className={`block bg-ink-800 rounded border-l-2 ${borderColor} px-1.5 py-0.5 text-[10px] text-paper-100 truncate hover:bg-ink-700 transition-colors`}
        >
          {article.headline}
        </Link>
      );
    };

    return (
      <AppShell>
        <div className="max-w-7xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-5">
            {/* Title block */}
            <div className="flex items-center gap-3">
              <HiOutlineSignal className="w-5 h-5 text-ink-300" />
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-400">
                  PUBLISHING RADAR
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* View mode toggle */}
              <div className="flex items-center bg-ink-900 border border-ink-700 rounded-lg p-0.5 gap-0.5">
                {(['week', 'month'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                      viewMode === mode
                        ? 'bg-press-500/20 text-press-400 border border-press-500/30'
                        : 'text-ink-400 hover:text-paper-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Today pill */}
              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider bg-press-500 text-white rounded-lg hover:bg-press-600 transition-colors"
              >
                Today
              </button>

              {/* Week/Month navigation */}
              {viewMode === 'week' ? (
                <div className="flex items-center bg-ink-800 border border-ink-700 rounded-lg">
                  <button
                    onClick={() => navigateWeek(-1)}
                    aria-label="Previous week"
                    className="p-2 hover:bg-ink-700 rounded-l-lg transition-colors"
                  >
                    <HiOutlineChevronLeft className="w-4 h-4 text-ink-300" />
                  </button>
                  <span className="px-3 font-mono text-xs text-paper-100 min-w-[160px] text-center">
                    {weekRangeLabel}
                  </span>
                  <button
                    onClick={() => navigateWeek(1)}
                    aria-label="Next week"
                    className="p-2 hover:bg-ink-700 rounded-r-lg transition-colors"
                  >
                    <HiOutlineChevronRight className="w-4 h-4 text-ink-300" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center bg-ink-800 border border-ink-700 rounded-lg">
                  <button
                    onClick={() => navigateMonth(-1)}
                    aria-label="Previous month"
                    className="p-2 hover:bg-ink-700 rounded-l-lg transition-colors"
                  >
                    <HiOutlineChevronLeft className="w-4 h-4 text-ink-300" />
                  </button>
                  <span className="px-3 font-mono text-xs text-paper-100 min-w-[140px] text-center">
                    {MONTHS[calendarData.month]} {calendarData.year}
                  </span>
                  <button
                    onClick={() => navigateMonth(1)}
                    aria-label="Next month"
                    className="p-2 hover:bg-ink-700 rounded-r-lg transition-colors"
                  >
                    <HiOutlineChevronRight className="w-4 h-4 text-ink-300" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Loading ──────────────────────────────────────────────────────── */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20 flex-1">
              <div className="animate-spin w-8 h-8 border-2 border-ink-700 border-t-press-500 rounded-full" />
            </div>
          ) : viewMode === 'week' ? (
            <>
              {/* ── Week View ──────────────────────────────────────────────── */}

              {/* Desktop: 7-column grid */}
              <div className="hidden sm:grid grid-cols-7 gap-px bg-ink-800 rounded-xl border border-ink-800 overflow-hidden flex-1">
                {weekDays.map((date, i) => {
                  const dayArticles = getArticlesForDate(date);
                  const isTodayDate = isToday(date);
                  const dateKey = etDateString(date);

                  return (
                    <div
                      key={i}
                      className={`flex flex-col bg-ink-900 ${isTodayDate ? 'bg-ink-800/50' : ''}`}
                    >
                      {/* Day header */}
                      <div className={`px-2 py-2 border-b border-ink-800 ${isTodayDate ? 'border-b-press-500/40' : ''}`}>
                        <div className={`text-[10px] font-mono uppercase tracking-[0.15em] ${isTodayDate ? 'text-press-400' : 'text-ink-400'}`}>
                          {DAYS[date.getDay()]}
                        </div>
                        <div className={`font-mono text-lg leading-tight mt-0.5 ${
                          isTodayDate
                            ? 'text-press-400 font-bold'
                            : 'text-paper-100'
                        }`}>
                          {date.getDate()}
                        </div>
                      </div>

                      {/* Article cards */}
                      <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
                        {dayArticles.length > 0 ? (
                          dayArticles.map(a => renderMCCard(a))
                        ) : (
                          <Link
                            href="/editor/new"
                            className="flex items-center justify-center gap-1 w-full border border-dashed border-ink-700 rounded py-2 text-ink-500 hover:text-ink-300 hover:border-ink-600 transition-colors"
                            aria-label={`New article for ${DAYS[date.getDay()]} ${date.getDate()}`}
                          >
                            <HiOutlinePlusCircle className="w-3 h-3" />
                            <span className="text-[10px] font-mono">New</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile: agenda stack */}
              <div className="sm:hidden space-y-2 flex-1">
                {weekDays.map((date, i) => {
                  const dayArticles = getArticlesForDate(date);
                  const isTodayDate = isToday(date);

                  return (
                    <div
                      key={i}
                      className={`flex gap-3 bg-ink-900 rounded-lg border p-3 ${
                        isTodayDate ? 'border-press-500/30' : 'border-ink-800'
                      }`}
                    >
                      {/* Date badge */}
                      <div className="flex-shrink-0 w-10 text-center">
                        <div className={`text-[10px] font-mono uppercase tracking-wider ${isTodayDate ? 'text-press-400' : 'text-ink-400'}`}>
                          {DAYS[date.getDay()]}
                        </div>
                        <div className={`font-mono text-xl font-bold leading-tight ${isTodayDate ? 'text-press-400' : 'text-paper-100'}`}>
                          {date.getDate()}
                        </div>
                      </div>

                      {/* Articles */}
                      <div className="flex-1 min-w-0 space-y-1">
                        {dayArticles.length > 0 ? (
                          dayArticles.map(a => renderMCCard(a))
                        ) : (
                          <Link
                            href="/editor/new"
                            className="flex items-center gap-1 text-ink-600 hover:text-ink-400 transition-colors"
                          >
                            <HiOutlinePlusCircle className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-mono">New article</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* ── Month View ──────────────────────────────────────────────────── */
            <div className="flex gap-6 flex-1">
              {/* Calendar grid */}
              <div className="flex-1 min-w-0">
                <div className="bg-ink-900 rounded-xl border border-ink-800 overflow-hidden">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 border-b border-ink-800">
                    {DAYS.map((day) => (
                      <div
                        key={day}
                        className="px-2 py-2.5 text-center text-[10px] font-mono uppercase tracking-[0.15em] text-ink-400"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Weeks */}
                  {weeks.map((week) => {
                    if (week.type === 'empty') {
                      return (
                        <div key={week.index} className="grid grid-cols-7 border-b border-ink-800/50">
                          {week.days.map((date, i) => (
                            <div key={i} className="px-2 py-1.5 text-center">
                              <span className={`text-[11px] font-mono ${
                                isCurrentMonth(date) ? 'text-ink-600' : 'text-ink-700'
                              }`}>
                                {date.getDate()}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    const isCurrent = week.type === 'current';
                    const minHeight = isCurrent ? 'min-h-[200px]' : 'min-h-[100px]';

                    return (
                      <div key={week.index} className="grid grid-cols-7 border-b border-ink-800">
                        {week.days.map((date, i) => {
                          const dateArticles = getArticlesForDate(date);
                          const isDateCurrentMonth = isCurrentMonth(date);
                          const isDateToday = isToday(date);
                          const dateKey = etDateString(date);
                          const isExpanded = expandedDates.has(dateKey);
                          const maxVisible = isCurrent ? 5 : 3;
                          const visibleArticles = isExpanded ? dateArticles : dateArticles.slice(0, maxVisible);

                          return (
                            <div
                              key={i}
                              className={`${minHeight} border-r border-ink-800 p-1.5 ${
                                !isDateCurrentMonth ? 'bg-ink-950/60' : ''
                              } ${isDateToday ? 'bg-ink-800/50' : ''} ${
                                i % 7 === 6 ? 'border-r-0' : ''
                              }`}
                            >
                              {/* Date number */}
                              <div className={`text-[11px] font-mono mb-1 ${
                                isDateToday
                                  ? 'w-6 h-6 rounded-full bg-press-500 text-white flex items-center justify-center font-bold'
                                  : isDateCurrentMonth
                                  ? 'text-paper-100'
                                  : 'text-ink-600'
                              }`}>
                                {date.getDate()}
                              </div>

                              {/* Articles */}
                              <div className="space-y-0.5">
                                {visibleArticles.map(a => renderMCMonthPill(a))}
                                {dateArticles.length > maxVisible && (
                                  <button
                                    onClick={() => toggleDateExpand(dateKey)}
                                    className="text-[10px] font-mono text-press-400 px-1 hover:text-press-300 hover:underline cursor-pointer"
                                  >
                                    {isExpanded ? 'less' : `+${dateArticles.length - maxVisible}`}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Publishing Insights sidebar — month view only */}
              <div className="hidden lg:block w-72 flex-shrink-0">
                <PublishingInsights />
              </div>
            </div>
          )}

          {/* ── Pipeline Summary Bar ─────────────────────────────────────────── */}
          <div className="mt-4 bg-ink-950 border border-ink-800 rounded-xl px-5 py-3">
            <div className="flex items-center gap-6 flex-wrap">
              {/* Published */}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#22C55E] flex-shrink-0" />
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-400">Published</span>
                <span className="font-mono text-sm text-paper-100">{published}</span>
              </div>

              {/* Scheduled */}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-400">Scheduled</span>
                <span className="font-mono text-sm text-paper-100">{scheduled}</span>
              </div>

              {/* Drafts */}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-400">Drafts</span>
                <span className="font-mono text-sm text-paper-100">{drafts}</span>
              </div>

              {/* Progress bar */}
              <div className="flex-1 min-w-[100px] flex items-center gap-2 ml-2">
                <div className="flex-1 h-1 bg-ink-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#22C55E] rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(publishedRatio * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-ink-400 flex-shrink-0">
                  {Math.round(publishedRatio * 100)}% pub
                </span>
              </div>
            </div>
          </div>

        </div>
      </AppShell>
    );
  }

  // ─── Classic return ──────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-display-md text-ink-950 dark:text-white">
              Editorial Calendar
            </h1>
            <p className="text-ink-400 mt-1 hidden sm:block">
              Plan and track your content schedule
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={goToToday}
              className="px-3 py-2 text-sm font-medium text-ink-600 dark:text-ink-300 bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-700 transition-colors"
            >
              Today
            </button>
            <div className="flex items-center bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-lg">
              <button
                onClick={() => navigateMonth(-1)}
                aria-label="Previous month"
                className="p-2 hover:bg-ink-50 dark:hover:bg-ink-700 rounded-l-lg transition-colors"
              >
                <HiOutlineChevronLeft className="w-5 h-5 text-ink-600 dark:text-ink-300" />
              </button>
              <span className="px-2 sm:px-4 font-medium text-ink-900 dark:text-white min-w-[120px] sm:min-w-[160px] text-center text-sm sm:text-base">
                {MONTHS[calendarData.month]} {calendarData.year}
              </span>
              <button
                onClick={() => navigateMonth(1)}
                aria-label="Next month"
                className="p-2 hover:bg-ink-50 dark:hover:bg-ink-700 rounded-r-lg transition-colors"
              >
                <HiOutlineChevronRight className="w-5 h-5 text-ink-600 dark:text-ink-300" />
              </button>
            </div>
          </div>
        </div>

        {/* === DESKTOP LAYOUT (lg+) === */}
        <div className="hidden lg:flex gap-6">
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-2 border-ink-200 border-t-press-500 rounded-full" />
              </div>
            ) : (
              <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 overflow-hidden">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-ink-100 dark:border-ink-800">
                  {DAYS.map((day) => (
                    <div
                      key={day}
                      className="px-3 py-3 text-center text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Weeks - dynamic row heights */}
                {weeks.map((week) => {
                  // Collapsed empty week - thin row with just date numbers
                  if (week.type === 'empty') {
                    return (
                      <div key={week.index} className="grid grid-cols-7 border-b border-ink-100/50 dark:border-ink-800/50">
                        {week.days.map((date, i) => (
                          <div key={i} className="px-3 py-1.5 text-center">
                            <span className={`text-xs ${
                              isCurrentMonth(date)
                                ? 'text-ink-300 dark:text-ink-600'
                                : 'text-ink-200 dark:text-ink-700'
                            }`}>
                              {date.getDate()}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  // Content or current week
                  const isCurrent = week.type === 'current';
                  const minHeight = isCurrent ? 'min-h-[240px]' : 'min-h-[120px]';

                  return (
                    <div key={week.index} className="grid grid-cols-7">
                      {week.days.map((date, i) => {
                        const dateArticles = getArticlesForDate(date);
                        const isDateCurrentMonth = isCurrentMonth(date);
                        const isDateToday = isToday(date);
                        const dateKey = etDateString(date);
                        const isExpanded = expandedDates.has(dateKey);
                        const maxVisible = isCurrent ? 6 : 3;
                        const visibleArticles = isExpanded ? dateArticles : dateArticles.slice(0, maxVisible);

                        return (
                          <div
                            key={i}
                            className={`${minHeight} border-b border-r border-ink-100 dark:border-ink-800 p-2 ${
                              !isDateCurrentMonth ? 'bg-ink-50 dark:bg-ink-950' : ''
                            } ${isDateToday && isCurrent ? 'bg-press-50/40 dark:bg-press-900/10' : ''} ${
                              i % 7 === 6 ? 'border-r-0' : ''
                            }`}
                          >
                            {/* Date number */}
                            <div className={`text-sm font-medium mb-1 ${
                              isDateToday
                                ? 'w-7 h-7 rounded-full bg-press-500 text-white flex items-center justify-center'
                                : isDateCurrentMonth
                                ? 'text-ink-900 dark:text-white'
                                : 'text-ink-400 dark:text-ink-600'
                            }`}>
                              {date.getDate()}
                            </div>

                            {/* Articles */}
                            <div className="space-y-1">
                              {visibleArticles.map((article) =>
                                isCurrent
                                  ? renderCurrentWeekArticle(article)
                                  : renderCompactArticle(article)
                              )}
                              {dateArticles.length > maxVisible && (
                                <button
                                  onClick={() => toggleDateExpand(dateKey)}
                                  className="text-[10px] text-press-600 dark:text-press-400 px-2 hover:text-press-700 dark:hover:text-press-300 hover:underline cursor-pointer"
                                >
                                  {isExpanded ? 'Show less' : `+${dateArticles.length - maxVisible} more`}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700" />
                <span className="text-ink-500 dark:text-ink-400">Published</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700" />
                <span className="text-ink-500 dark:text-ink-400">Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700" />
                <span className="text-ink-500 dark:text-ink-400">Scheduled</span>
              </div>
            </div>
          </div>

          {/* Publishing Insights Sidebar */}
          <div className="w-80 flex-shrink-0">
            <PublishingInsights />
          </div>
        </div>

        {/* === MOBILE LAYOUT (<lg) === */}
        <div className="lg:hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-ink-200 border-t-press-500 rounded-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Current week - full agenda view */}
              {weeks.filter(w => w.type === 'current').map((week) => (
                <div key={week.index} className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-800/50">
                    <span className="text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">
                      This Week
                    </span>
                  </div>
                  {week.days.map((date, i) => {
                    const dateArticles = getArticlesForDate(date);
                    const isDateToday = isToday(date);
                    const dayName = DAYS[date.getDay()];

                    return (
                      <div
                        key={i}
                        className={`flex gap-3 px-4 py-3 ${
                          i < 6 ? 'border-b border-ink-100 dark:border-ink-800' : ''
                        } ${isDateToday ? 'bg-press-50/40 dark:bg-press-900/10' : ''}`}
                      >
                        {/* Date badge */}
                        <div className="flex-shrink-0 w-11 text-center pt-0.5">
                          <div className={`text-lg font-bold leading-tight ${
                            isDateToday
                              ? 'text-press-500'
                              : isCurrentMonth(date)
                              ? 'text-ink-900 dark:text-white'
                              : 'text-ink-300 dark:text-ink-600'
                          }`}>
                            {date.getDate()}
                          </div>
                          <div className={`text-[10px] uppercase ${
                            isDateToday ? 'text-press-500 font-semibold' : 'text-ink-400 dark:text-ink-500'
                          }`}>
                            {dayName}
                          </div>
                        </div>

                        {/* Articles for this day */}
                        <div className="flex-1 min-w-0">
                          {dateArticles.length > 0 ? (
                            <div className="space-y-1.5">
                              {dateArticles.map(article => renderCurrentWeekArticle(article))}
                            </div>
                          ) : (
                            <div className="text-xs text-ink-300 dark:text-ink-600 py-1">&mdash;</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Past/future content weeks - collapsible */}
              {weeks.filter(w => w.type === 'content').map((week) => {
                const articleCount = getWeekArticleCount(week);
                const isMobileExpanded = expandedMobileWeeks.has(week.index);

                return (
                  <div key={week.index} className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 overflow-hidden">
                    <button
                      onClick={() => toggleMobileWeek(week.index)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink-900 dark:text-white">
                          {formatWeekRange(week)}
                        </span>
                        <span className="text-xs text-ink-400 dark:text-ink-500">
                          &middot; {articleCount} article{articleCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <HiOutlineChevronDown
                        className={`w-4 h-4 text-ink-400 transition-transform ${isMobileExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isMobileExpanded && (
                      <div className="border-t border-ink-100 dark:border-ink-800">
                        {week.days.map((date, i) => {
                          const dateArticles = getArticlesForDate(date);
                          if (dateArticles.length === 0) return null;
                          const dayName = DAYS[date.getDay()];

                          return (
                            <div
                              key={i}
                              className="flex gap-3 px-4 py-2.5 border-b border-ink-100/50 dark:border-ink-800/50 last:border-b-0"
                            >
                              <div className="flex-shrink-0 w-11 text-center">
                                <div className="text-sm font-medium text-ink-700 dark:text-ink-300">
                                  {date.getDate()}
                                </div>
                                <div className="text-[10px] text-ink-400 dark:text-ink-500 uppercase">
                                  {dayName}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0 space-y-1">
                                {dateArticles.map(article => renderCurrentWeekArticle(article))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 text-xs py-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700" />
                  <span className="text-ink-500 dark:text-ink-400">Published</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700" />
                  <span className="text-ink-500 dark:text-ink-400">Approved</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700" />
                  <span className="text-ink-500 dark:text-ink-400">Scheduled</span>
                </div>
              </div>

              {/* Publishing Insights - stacked below on mobile */}
              <PublishingInsights />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
