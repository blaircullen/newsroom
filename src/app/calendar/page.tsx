'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PublishingInsights from '@/components/calendar/PublishingInsights';
import {
  HiOutlineCalendarDays,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineGlobeAlt,
  HiOutlineLightBulb,
} from 'react-icons/hi2';

interface CalendarArticle {
  id: string;
  headline: string;
  status: string;
  publishedAt: string | null;
  scheduledPublishAt: string | null;
  author: { name: string };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [articles, setArticles] = useState<CalendarArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'month' | 'week'>('month');
  const [insightsOpen, setInsightsOpen] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'EDITOR';

  // Load insights sidebar state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('calendar-insights-open');
    if (saved === 'true') {
      setInsightsOpen(true);
    }
  }, []);

  // Persist insights sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('calendar-insights-open', String(insightsOpen));
  }, [insightsOpen]);

  // Get calendar dates
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Start from previous month to fill grid
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // End after last day to fill grid
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

  // Get articles for a specific date
  const getArticlesForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return articles.filter((a) => {
      const pubDate = a.publishedAt ? new Date(a.publishedAt).toISOString().split('T')[0] : null;
      const schedDate = a.scheduledPublishAt ? new Date(a.scheduledPublishAt).toISOString().split('T')[0] : null;
      return pubDate === dateStr || schedDate === dateStr;
    });
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  if (!isAdmin) return null;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-display-md text-ink-950 dark:text-white">
              Editorial Calendar
            </h1>
            <p className="text-ink-400 mt-1">
              Plan and track your content schedule
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Insights toggle button */}
            <button
              onClick={() => setInsightsOpen(!insightsOpen)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                insightsOpen
                  ? 'bg-press-50 dark:bg-press-900/30 text-press-600 dark:text-press-400 border-press-200 dark:border-press-800'
                  : 'text-ink-600 dark:text-ink-300 bg-white dark:bg-ink-800 border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-700'
              }`}
            >
              <HiOutlineLightBulb className="w-4 h-4" />
              <span className="hidden sm:inline">Insights</span>
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-2 text-sm font-medium text-ink-600 dark:text-ink-300 bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-700 transition-colors"
            >
              Today
            </button>
            <div className="flex items-center bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-lg">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-ink-50 dark:hover:bg-ink-700 rounded-l-lg transition-colors"
              >
                <HiOutlineChevronLeft className="w-5 h-5 text-ink-600 dark:text-ink-300" />
              </button>
              <span className="px-4 font-medium text-ink-900 dark:text-white min-w-[160px] text-center">
                {MONTHS[calendarData.month]} {calendarData.year}
              </span>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 hover:bg-ink-50 dark:hover:bg-ink-700 rounded-r-lg transition-colors"
              >
                <HiOutlineChevronRight className="w-5 h-5 text-ink-600 dark:text-ink-300" />
              </button>
            </div>
          </div>
        </div>

        {/* Main content with optional sidebar */}
        <div className="flex gap-6">
          {/* Calendar */}
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

                {/* Calendar grid */}
                <div className="grid grid-cols-7">
                  {calendarData.days.map((date, i) => {
                    const dateArticles = getArticlesForDate(date);
                    const isCurrent = isCurrentMonth(date);
                    const isDateToday = isToday(date);

                    return (
                      <div
                        key={i}
                        className={`min-h-[120px] border-b border-r border-ink-100 dark:border-ink-800 p-2 ${
                          !isCurrent ? 'bg-ink-50 dark:bg-ink-950' : ''
                        } ${i % 7 === 6 ? 'border-r-0' : ''}`}
                      >
                        {/* Date number */}
                        <div className={`text-sm font-medium mb-1 ${
                          isDateToday
                            ? 'w-7 h-7 rounded-full bg-press-500 text-white flex items-center justify-center'
                            : isCurrent
                            ? 'text-ink-900 dark:text-white'
                            : 'text-ink-400 dark:text-ink-600'
                        }`}>
                          {date.getDate()}
                        </div>

                        {/* Articles */}
                        <div className="space-y-1">
                          {dateArticles.slice(0, 3).map((article) => (
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
                          ))}
                          {dateArticles.length > 3 && (
                            <p className="text-[10px] text-ink-400 px-2">
                              +{dateArticles.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden hidden lg:block ${
              insightsOpen ? 'w-80 opacity-100' : 'w-0 opacity-0'
            }`}
          >
            <div className="w-80">
              <PublishingInsights
                isOpen={insightsOpen}
                onClose={() => setInsightsOpen(false)}
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
