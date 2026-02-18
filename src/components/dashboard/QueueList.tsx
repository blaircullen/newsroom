'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Article } from './ArticleCard';

interface QueueListProps {
  articles: Article[];
  isAdmin: boolean;
  onDelete?: (id: string, headline: string) => void;
}

const statusColors: Record<string, { border: string; bg: string; text: string; label: string }> = {
  SUBMITTED: { border: 'border-l-press-500 shadow-[inset_3px_0_8px_-3px_rgba(212,43,43,0.3)]', bg: 'bg-press-500/10', text: 'text-press-400', label: 'Submitted' },
  IN_REVIEW: { border: 'border-l-amber-500 shadow-[inset_3px_0_8px_-3px_rgba(245,158,11,0.3)]', bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'In Review' },
  REVISION_REQUESTED: { border: 'border-l-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Revision' },
  APPROVED: { border: 'border-l-signal-success', bg: 'bg-signal-success/10', text: 'text-signal-success', label: 'Approved' },
  DRAFT: { border: 'border-l-ink-600', bg: 'bg-ink-800', text: 'text-paper-500', label: 'Draft' },
  PUBLISHED: { border: 'border-l-press-500', bg: 'bg-press-500/10', text: 'text-press-400', label: 'Published' },
};

function getStatusConfig(status: string) {
  return statusColors[status] ?? statusColors.DRAFT;
}

export default function QueueList({ articles, isAdmin, onDelete: _onDelete }: QueueListProps) {
  const [tab, setTab] = useState<'mine' | 'all'>('all');

  const queueArticles = articles.filter(a => a.status !== 'PUBLISHED');
  const needsAction = queueArticles.filter(a => ['SUBMITTED', 'IN_REVIEW'].includes(a.status)).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="terminal-label text-paper-400">Queue</h2>
          {needsAction > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-press-500/15 text-press-400 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-press-500 animate-pulse-live" />
              {needsAction} need{needsAction === 1 ? 's' : ''} action
            </span>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-1 bg-ink-900 rounded-lg p-0.5">
            <button
              onClick={() => setTab('all')}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors duration-150 ${
                tab === 'all' ? 'bg-ink-700 text-paper-200' : 'text-paper-500 hover:text-paper-300'
              }`}
            >
              All Pending
            </button>
            <button
              onClick={() => setTab('mine')}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors duration-150 ${
                tab === 'mine' ? 'bg-ink-700 text-paper-200' : 'text-paper-500 hover:text-paper-300'
              }`}
            >
              My Drafts
            </button>
          </div>
        )}
      </div>

      {/* Article Queue */}
      <div className="space-y-2">
        {queueArticles.length === 0 ? (
          <div className="text-center py-8 text-paper-500 text-sm">
            Queue is empty — all caught up!
          </div>
        ) : (
          queueArticles.map((article) => {
            const config = getStatusConfig(article.status);
            const isReady = article.status === 'APPROVED';
            return (
              <Link
                key={article.id}
                href={`/editor/${article.id}`}
                className={`block border-l-4 ${config.border} bg-ink-900 rounded-r-lg border border-ink-800 border-l-0 hover:border-ink-600 transition-all duration-150 group`}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-paper-100 text-sm font-medium truncate group-hover:text-white transition-colors">
                      {article.headline || 'Untitled'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-paper-500">{article.author?.name}</span>
                      <span className="text-xs text-paper-600">·</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.text}`}>
                        {config.label}
                      </span>
                      <span className="text-xs text-paper-600">·</span>
                      <span className="text-xs text-paper-500">
                        {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  {/* Readiness indicator */}
                  <div className="ml-3 shrink-0">
                    {isReady ? (
                      <span className="w-3 h-3 rounded-full bg-signal-success shadow-glow-success inline-block" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border-2 border-paper-500 inline-block" />
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
