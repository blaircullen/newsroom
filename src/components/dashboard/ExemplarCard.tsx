'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineTrash,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineClock,
} from 'react-icons/hi2';

export interface Exemplar {
  id: string;
  url: string;
  title: string | null;
  source: string | null;
  category: string | null;
  status: 'PENDING' | 'PREVIEW_READY' | 'ANALYZED' | 'FAILED';
  quickSummary: string | null;
  detectedTopics: string[];
  fingerprint: {
    topics: string[];
    keywords: Record<string, number>;
    tone: string;
    politicalFraming: string;
    headlineStyle: string;
    structureNotes: string;
    audienceAlignment: number;
    strengthSignals: string[];
    similarToCategories: string[];
  } | null;
  wordCount: number | null;
  notes: string | null;
  createdAt: string;
  analyzedAt: string | null;
  submittedBy: { id: string; name: string };
}

interface ExemplarCardProps {
  exemplar: Exemplar;
  onDeleted: () => void;
}

function StatusBadge({ status }: { status: Exemplar['status'] }) {
  switch (status) {
    case 'ANALYZED':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
          <HiOutlineCheckCircle className="w-3 h-3" />
          Analyzed
        </span>
      );
    case 'PREVIEW_READY':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400 text-[11px] font-semibold">
          <HiOutlineArrowPath className="w-3 h-3 animate-spin" />
          Processing
        </span>
      );
    case 'PENDING':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-500 dark:text-ink-400 text-[11px] font-semibold">
          <HiOutlineClock className="w-3 h-3" />
          Pending
        </span>
      );
    case 'FAILED':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-[11px] font-semibold">
          <HiOutlineExclamationTriangle className="w-3 h-3" />
          Failed
        </span>
      );
  }
}

function AlignmentBadge({ score }: { score: number }) {
  const colorClass =
    score >= 80
      ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
      : score >= 60
      ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400'
      : 'bg-ink-100 dark:bg-ink-800 border-ink-200 dark:border-ink-700 text-ink-500 dark:text-ink-400';

  return (
    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${colorClass}`}>
      {score}% fit
    </span>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function ExemplarCard({ exemplar, onDeleted }: ExemplarCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fp = exemplar.fingerprint;

  const topKeywords = fp
    ? Object.entries(fp.keywords)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 12)
    : [];

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/exemplars/${exemplar.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        toast.error(data.error ?? 'Failed to delete exemplar.');
        return;
      }
      toast.success('Exemplar deleted.');
      onDeleted();
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-700 overflow-hidden">
      <div className="p-4">
        {/* Header row: badges + delete */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={exemplar.status} />
            {exemplar.category && (
              <span className="px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-400 text-[11px] font-semibold">
                {exemplar.category}
              </span>
            )}
            {fp?.audienceAlignment !== undefined && (
              <AlignmentBadge score={fp.audienceAlignment} />
            )}
          </div>

          {/* Delete control */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {confirmDelete ? (
              <>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-60"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                  className="px-2.5 py-1 rounded-md bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-md text-ink-300 dark:text-ink-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Delete exemplar"
              >
                <HiOutlineTrash className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-display font-semibold text-ink-900 dark:text-ink-100 text-base leading-snug mb-1">
          {exemplar.title ?? exemplar.source ?? 'Untitled'}
        </h3>

        {/* Quick summary */}
        {exemplar.quickSummary && (
          <p className="text-sm text-ink-500 dark:text-ink-400 leading-relaxed mb-3">
            {exemplar.quickSummary}
          </p>
        )}

        {/* Topic tags */}
        {exemplar.detectedTopics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {exemplar.detectedTopics.map((topic) => (
              <span
                key={topic}
                className="px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 text-[11px]"
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400 dark:text-ink-500 mb-3">
          {exemplar.source && (
            <a
              href={exemplar.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            >
              {exemplar.source}
              <HiOutlineArrowTopRightOnSquare className="w-3 h-3" />
            </a>
          )}
          {exemplar.wordCount && (
            <span>{exemplar.wordCount.toLocaleString()} words</span>
          )}
          <span>{formatDate(exemplar.createdAt)}</span>
          <span>by {exemplar.submittedBy.name}</span>
        </div>

        {/* Notes */}
        {exemplar.notes && (
          <div className="mb-3 px-3 py-2.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800">
            <p className="text-sm text-violet-800 dark:text-violet-300 italic">
              &ldquo;{exemplar.notes}&rdquo;
            </p>
          </div>
        )}

        {/* Fingerprint toggle */}
        {fp && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-colors font-medium"
          >
            {expanded ? (
              <>
                <HiOutlineChevronUp className="w-3.5 h-3.5" />
                Hide Details
              </>
            ) : (
              <>
                <HiOutlineChevronDown className="w-3.5 h-3.5" />
                Show Fingerprint
              </>
            )}
          </button>
        )}
      </div>

      {/* Expanded fingerprint panel */}
      {expanded && fp && (
        <div className="border-t border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-950 px-4 py-4 space-y-4">
          {/* 3-column grid: Tone, Framing, Headline Style */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-ink-400 dark:text-ink-500 mb-1">Tone</p>
              <p className="text-sm text-ink-700 dark:text-ink-300">{fp.tone}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-ink-400 dark:text-ink-500 mb-1">Framing</p>
              <p className="text-sm text-ink-700 dark:text-ink-300">{fp.politicalFraming}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-ink-400 dark:text-ink-500 mb-1">Headline Style</p>
              <p className="text-sm text-ink-700 dark:text-ink-300">{fp.headlineStyle}</p>
            </div>
          </div>

          {/* Structure notes */}
          {fp.structureNotes && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-ink-400 dark:text-ink-500 mb-1">Structure Notes</p>
              <p className="text-sm text-ink-600 dark:text-ink-400 leading-relaxed">{fp.structureNotes}</p>
            </div>
          )}

          {/* Strength signals */}
          {fp.strengthSignals.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-ink-400 dark:text-ink-500 mb-2">Strength Signals</p>
              <div className="flex flex-wrap gap-1.5">
                {fp.strengthSignals.map((signal) => (
                  <span
                    key={signal}
                    className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 text-[11px]"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top keywords */}
          {topKeywords.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-ink-400 dark:text-ink-500 mb-2">Top Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {topKeywords.map(([keyword, weight]) => (
                  <span
                    key={keyword}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-400 text-[11px]"
                  >
                    {keyword}
                    <span className="text-ink-400 dark:text-ink-500">{weight.toFixed(1)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Similar categories */}
          {fp.similarToCategories.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-ink-400 dark:text-ink-500 mb-2">Similar Categories</p>
              <div className="flex flex-wrap gap-1.5">
                {fp.similarToCategories.map((cat) => (
                  <span
                    key={cat}
                    className="px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-400 text-[11px]"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
