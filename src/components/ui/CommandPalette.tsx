'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  HiOutlineMagnifyingGlass,
  HiOutlineDocumentText,
  HiOutlinePlusCircle,
  HiOutlineHome,
  HiOutlineUserGroup,
  HiOutlineGlobeAlt,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineCog6Tooth,
  HiOutlineMoon,
  HiOutlineSun,
} from 'react-icons/hi2';
import { useTheme } from '@/contexts/ThemeContext';
import { useTrack } from '@/hooks/useTrack';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  keywords?: string[];
  category: 'navigation' | 'action' | 'settings';
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [articles, setArticles] = useState<{ id: string; headline: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const track = useTrack();

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'EDITOR';

  // Define commands
  const commands: CommandItem[] = [
    {
      id: 'new-story',
      label: 'New Story',
      description: 'Create a new article',
      icon: HiOutlinePlusCircle,
      action: () => router.push('/editor'),
      keywords: ['create', 'write', 'article', 'new'],
      category: 'action',
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'Go to main dashboard',
      icon: HiOutlineHome,
      action: () => router.push('/dashboard'),
      keywords: ['home', 'main'],
      category: 'navigation',
    },
    {
      id: 'drafts',
      label: 'View Drafts',
      description: 'See all draft articles',
      icon: HiOutlineDocumentText,
      action: () => router.push('/dashboard?filter=draft'),
      keywords: ['drafts', 'unpublished'],
      category: 'navigation',
    },
    {
      id: 'published',
      label: 'View Published',
      description: 'See all published articles',
      icon: HiOutlineGlobeAlt,
      action: () => router.push('/dashboard?filter=published'),
      keywords: ['published', 'live'],
      category: 'navigation',
    },
    ...(isAdmin ? [
      {
        id: 'review',
        label: 'Review Queue',
        description: 'Articles awaiting review',
        icon: HiOutlineDocumentText,
        action: () => router.push('/dashboard?filter=submitted'),
        keywords: ['review', 'submitted', 'pending'],
        category: 'navigation' as const,
      },
      {
        id: 'calendar',
        label: 'Editorial Calendar',
        description: 'View content calendar',
        icon: HiOutlineCalendarDays,
        action: () => router.push('/calendar'),
        keywords: ['schedule', 'calendar', 'plan'],
        category: 'navigation' as const,
      },
      {
        id: 'analytics',
        label: 'Performance Hub',
        description: 'View analytics and insights',
        icon: HiOutlineChartBar,
        action: () => router.push('/analytics'),
        keywords: ['analytics', 'stats', 'performance', 'metrics'],
        category: 'navigation' as const,
      },
      {
        id: 'users',
        label: 'Manage Writers',
        description: 'User management',
        icon: HiOutlineUserGroup,
        action: () => router.push('/admin/users'),
        keywords: ['users', 'writers', 'team'],
        category: 'navigation' as const,
      },
      {
        id: 'sites',
        label: 'Publish Sites',
        description: 'Manage publishing targets',
        icon: HiOutlineGlobeAlt,
        action: () => router.push('/admin/sites'),
        keywords: ['sites', 'wordpress', 'ghost', 'publish'],
        category: 'navigation' as const,
      },
    ] : []),
    {
      id: 'toggle-theme',
      label: resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      description: 'Toggle dark/light theme',
      icon: resolvedTheme === 'dark' ? HiOutlineSun : HiOutlineMoon,
      action: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
      keywords: ['theme', 'dark', 'light', 'mode'],
      category: 'settings',
    },
  ];

  // Filter commands based on query
  const filteredCommands = query
    ? commands.filter((cmd) => {
        const searchStr = `${cmd.label} ${cmd.description} ${cmd.keywords?.join(' ')}`.toLowerCase();
        return searchStr.includes(query.toLowerCase());
      })
    : commands;

  // Filter articles based on query
  const filteredArticles = query.length >= 2
    ? articles.filter((a) => a.headline.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  const allResults = [
    ...filteredCommands.map((c) => ({ type: 'command' as const, item: c })),
    ...filteredArticles.map((a) => ({ type: 'article' as const, item: a })),
  ];

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        track('command_palette', 'open');
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    // Listen for custom event to open palette
    const handleOpenPalette = () => setIsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('openCommandPalette', handleOpenPalette);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('openCommandPalette', handleOpenPalette);
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
      // Fetch recent articles for search
      fetch('/api/articles?limit=50')
        .then((res) => res.json())
        .then((data) => setArticles(data.articles || []))
        .catch(() => {});
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = allResults[selectedIndex];
        if (selected) {
          track('command_palette', 'search', { query, type: selected.type });
          if (selected.type === 'command') {
            selected.item.action();
          } else {
            router.push(`/editor/${selected.item.id}`);
          }
          setIsOpen(false);
        }
      }
    },
    [allResults, selectedIndex, router]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-950/50 dark:bg-black/70 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette */}
      <div className="relative max-w-2xl mx-4 md:mx-auto mt-4 md:mt-[15vh]">
        <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-2xl border border-ink-200 dark:border-ink-700 overflow-hidden max-h-[85vh]">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-ink-100 dark:border-ink-800">
            <HiOutlineMagnifyingGlass className="w-5 h-5 text-ink-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search commands, articles..."
              className="flex-1 bg-transparent text-ink-900 dark:text-white placeholder-ink-400 focus:outline-none text-base"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-ink-400 bg-ink-100 dark:bg-ink-800 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {allResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-ink-400">
                No results found for "{query}"
              </div>
            ) : (
              <>
                {/* Commands */}
                {filteredCommands.length > 0 && (
                  <div className="mb-2">
                    <div className="px-3 py-2 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                      Commands
                    </div>
                    {filteredCommands.map((cmd, i) => {
                      const Icon = cmd.icon;
                      const globalIndex = i;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            cmd.action();
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            selectedIndex === globalIndex
                              ? 'bg-press-50 dark:bg-press-900/30 text-press-700 dark:text-press-300'
                              : 'text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            selectedIndex === globalIndex
                              ? 'bg-press-100 dark:bg-press-800/50 text-press-600 dark:text-press-400'
                              : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{cmd.label}</p>
                            {cmd.description && (
                              <p className="text-xs text-ink-400 truncate">{cmd.description}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Articles */}
                {filteredArticles.length > 0 && (
                  <div>
                    <div className="px-3 py-2 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                      Articles
                    </div>
                    {filteredArticles.map((article, i) => {
                      const globalIndex = filteredCommands.length + i;
                      return (
                        <button
                          key={article.id}
                          onClick={() => {
                            router.push(`/editor/${article.id}`);
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            selectedIndex === globalIndex
                              ? 'bg-press-50 dark:bg-press-900/30 text-press-700 dark:text-press-300'
                              : 'text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            selectedIndex === globalIndex
                              ? 'bg-press-100 dark:bg-press-800/50 text-press-600 dark:text-press-400'
                              : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400'
                          }`}>
                            <HiOutlineDocumentText className="w-4 h-4" />
                          </div>
                          <p className="font-medium truncate">{article.headline}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/50">
            <div className="flex items-center gap-4 text-xs text-ink-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-ink-700 rounded shadow-sm">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-ink-700 rounded shadow-sm">↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-ink-700 rounded shadow-sm">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-ink-700 rounded shadow-sm">esc</kbd>
                close
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
