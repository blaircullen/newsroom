'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { HiChevronUp, HiChevronDown } from 'react-icons/hi2';

interface WireEvent {
  id: string;
  title: string;
  author: string;
  action: string;
  timestamp: Date;
}

export default function WireTicker() {
  const [events, setEvents] = useState<WireEvent[]>([]);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wire-ticker-collapsed') === 'true';
    }
    return false;
  });

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch('/api/articles?limit=10&sortBy=updatedAt');
        if (!res.ok) return;
        const data = await res.json();
        const mapped: WireEvent[] = (data.articles || []).map((a: {
          id: string;
          headline?: string;
          status?: string;
          author?: { name?: string };
          updatedAt: string;
        }) => ({
          id: a.id,
          title: a.headline || 'Untitled',
          author: a.author?.name || 'Unknown',
          action:
            a.status === 'PUBLISHED'
              ? 'published'
              : a.status === 'SUBMITTED'
              ? 'submitted'
              : 'updated',
          timestamp: new Date(a.updatedAt),
        }));
        setEvents(mapped);
      } catch {
        // Silently fail — ticker is non-critical
      }
    }

    fetchEvents();
    const interval = setInterval(fetchEvents, 60_000);
    return () => clearInterval(interval);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('wire-ticker-collapsed', String(next));
  };

  if (collapsed) {
    return (
      <div className="hidden md:flex fixed top-14 left-0 right-0 z-30 h-6 bg-ink-900 border-b border-ink-800 items-center justify-center">
        <button
          onClick={toggleCollapsed}
          className="text-paper-500 hover:text-paper-300 transition-colors duration-150"
          aria-label="Expand wire ticker"
        >
          <HiChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="hidden md:flex fixed top-14 left-0 right-0 z-30 h-8 bg-ink-900 border-b border-ink-800 items-center overflow-hidden">
      <span className="shrink-0 px-3 terminal-label text-press-500">Wire</span>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-6 animate-marquee whitespace-nowrap">
          {events.length === 0 ? (
            <span className="text-xs text-paper-500">No recent activity</span>
          ) : (
            <>
              {[...events, ...events].map((e, i) => (
                <Link
                  key={`${e.id}-${i}`}
                  href={`/editor/${e.id}`}
                  className="inline-flex items-center gap-1.5 text-xs text-paper-300 hover:text-paper-100 transition-colors duration-150"
                >
                  <span className="font-medium text-paper-100">{e.author}</span>
                  <span className="text-paper-500">{e.action}</span>
                  <span className="truncate max-w-[200px]">&ldquo;{e.title}&rdquo;</span>
                  <span className="text-paper-500">&middot;</span>
                  <span className="text-paper-500">
                    {formatDistanceToNow(e.timestamp, { addSuffix: true })}
                  </span>
                </Link>
              ))}
            </>
          )}
        </div>
      </div>
      <button
        onClick={toggleCollapsed}
        className="shrink-0 px-2 text-paper-500 hover:text-paper-300 transition-colors duration-150"
        aria-label="Collapse wire ticker"
      >
        <HiChevronUp className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
