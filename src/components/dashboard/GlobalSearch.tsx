'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  HiOutlineMagnifyingGlass,
  HiOutlineDocumentText,
  HiOutlineXMark,
} from 'react-icons/hi2';

interface SearchResult {
  id: string;
  headline: string;
  subHeadline?: string;
  status: string;
  author: { name: string };
  updatedAt: string;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/articles/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.articles || []);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        router.push(`/editor/${results[selectedIndex].id}`);
        setIsOpen(false);
        setQuery('');
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    },
    [results, selectedIndex, router]
  );

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-300',
    SUBMITTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    PUBLISHED: 'bg-press-100 text-press-700 dark:bg-press-900/50 dark:text-press-300',
    REVISION_REQUESTED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Search Input */}
      <div className="relative">
        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search articles..."
          className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-lg text-ink-900 dark:text-white placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-press-500/20 focus:border-press-500 transition-all text-sm"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"
          >
            <HiOutlineXMark className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {isLoading ? (
            <div className="px-4 py-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-ink-200 border-t-press-500 rounded-full mx-auto" />
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-ink-400">
              No articles found for "{query}"
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {results.map((article, index) => (
                <button
                  key={article.id}
                  onClick={() => {
                    router.push(`/editor/${article.id}`);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-press-50 dark:bg-press-900/30'
                      : 'hover:bg-ink-50 dark:hover:bg-ink-800'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center flex-shrink-0">
                    <HiOutlineDocumentText className="w-4 h-4 text-ink-500 dark:text-ink-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink-900 dark:text-white truncate">
                      {article.headline}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColors[article.status] || statusColors.DRAFT}`}>
                        {article.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-ink-400">
                        by {article.author.name}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/50">
            <p className="text-xs text-ink-400">
              Press <kbd className="px-1 py-0.5 bg-white dark:bg-ink-700 rounded text-[10px]">↵</kbd> to open,{' '}
              <kbd className="px-1 py-0.5 bg-white dark:bg-ink-700 rounded text-[10px]">↑↓</kbd> to navigate
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
