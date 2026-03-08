'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import {
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineArrowTopRightOnSquare,
  HiOutlinePencilSquare,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineBellAlert,
  HiOutlineClock,
  HiOutlineSignal,
  HiOutlineSparkles,
} from 'react-icons/hi2';

// ── Types ────────────────────────────────────────────────────────────────────

interface ScanRun {
  id: string;
  createdAt: string;
  status: string;
  rawCount: number | null;
  pickedCount: number | null;
  approved: number;
  skipped: number;
  pending: number;
}

interface ScanPick {
  id: string;
  rank: number;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: string;
  priority: string;
  status: string;
  skipReason: string | null;
  feedbackNotes: string | null;
  processedAt: string | null;
  articleId: string | null;
}

const SKIP_REASONS = [
  { value: 'duplicate',       label: 'Duplicate story' },
  { value: 'not_relevant',    label: 'Not relevant' },
  { value: 'bad_angle',       label: 'Bad angle for our audience' },
  { value: 'unverified',      label: 'Unverified / single source' },
  { value: 'already_covered', label: 'Already covered' },
  { value: 'other',           label: 'Other' },
];

const PRIORITY_CONFIG: Record<string, { dot: string; border: string; ring: string }> = {
  high:   { dot: 'bg-press-500',  border: 'border-l-press-500',  ring: 'ring-press-500/20' },
  medium: { dot: 'bg-amber-500',  border: 'border-l-amber-500',  ring: 'ring-amber-500/20' },
  low:    { dot: 'bg-ink-500',    border: 'border-l-ink-500',    ring: 'ring-ink-500/20'   },
};

const CATEGORY_COLORS: Record<string, string> = {
  politics:       'bg-blue-900/50 text-blue-300',
  crime:          'bg-red-900/50 text-red-300',
  immigration:    'bg-orange-900/50 text-orange-300',
  economy:        'bg-yellow-900/50 text-yellow-300',
  foreign_policy: 'bg-purple-900/50 text-purple-300',
  legal:          'bg-indigo-900/50 text-indigo-300',
  media:          'bg-teal-900/50 text-teal-300',
  culture:        'bg-pink-900/50 text-pink-300',
  security:       'bg-slate-700/50 text-slate-300',
  breaking:       'bg-press-900/50 text-press-300',
  other:          'bg-ink-700/50 text-ink-300',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRunTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: true, timeZoneName: 'short',
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <div
      className={`${className} border-2 border-ink-700 border-t-press-500 rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
}

// ── Skip Modal ───────────────────────────────────────────────────────────────

function SkipModal({
  pickId, onConfirm, onCancel,
}: {
  pickId: string;
  onConfirm: (pickId: string, reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('not_relevant');

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-ink-900 border border-white/10 rounded-2xl p-6 w-84 shadow-2xl ring-1 ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-semibold mb-1">Skip this story</h3>
        <p className="text-ink-400 text-xs mb-4">Select a reason to help improve future picks</p>
        <div className="space-y-1 mb-5">
          {SKIP_REASONS.map((r) => (
            <label
              key={r.value}
              className={`flex items-center gap-3 cursor-pointer px-3 py-2 rounded-lg transition-colors ${
                reason === r.value ? 'bg-ink-800 ring-1 ring-white/10' : 'hover:bg-ink-800/50'
              }`}
            >
              <input
                type="radio"
                name="skip-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="accent-press-500 flex-shrink-0"
              />
              <span className={`text-sm transition-colors ${reason === r.value ? 'text-white' : 'text-ink-300'}`}>
                {r.label}
              </span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(pickId, reason)}
            className="flex-1 bg-press-600 hover:bg-press-500 active:bg-press-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-press-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
          >
            Skip Story
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-ink-800 hover:bg-ink-700 active:bg-ink-750 text-ink-200 text-sm font-medium py-2.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pick Card ────────────────────────────────────────────────────────────────

function PickCard({
  pick,
  isActive,
  onActivate,
  onApprove,
  onSkip,
}: {
  pick: ScanPick;
  isActive: boolean;
  onActivate: () => void;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  const prio = PRIORITY_CONFIG[pick.priority] ?? PRIORITY_CONFIG.low;
  const catColor = CATEGORY_COLORS[pick.category] ?? CATEGORY_COLORS.other;
  const isPending = pick.status === 'PENDING';
  const isApproved = pick.status === 'APPROVED';
  const isSkipped = pick.status === 'SKIPPED';
  const isBreaking = pick.priority === 'high';

  return (
    <div
      onClick={isPending ? onActivate : undefined}
      className={`border-l-2 rounded-r-xl mb-2 transition-all duration-200
        ${prio.border}
        ${isPending ? 'cursor-pointer' : ''}
        ${isSkipped ? 'opacity-35' : ''}
        ${isActive
          ? `bg-ink-800/90 border border-white/10 shadow-lg ring-1 ${prio.ring}`
          : 'bg-ink-900/60 border border-transparent hover:bg-ink-800/50 hover:border-white/5'}
      `}
    >
      <div className="flex items-start gap-3 p-3 pr-3">
        {/* Rank + priority indicator */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-0.5 w-6">
          <span className="text-ink-500 text-[10px] font-mono font-bold leading-none">#{pick.rank}</span>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${prio.dot}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="text-ink-400 text-[11px] font-medium uppercase tracking-wider leading-none">
              {pick.source.replace('X/@', '@').replace(' (tweet)', '')}
            </span>
            <span className="text-ink-700 text-[11px]">·</span>
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full leading-none ${catColor}`}>
              {pick.category.replaceAll('_', ' ')}
            </span>
            {isBreaking && (
              <span className="flex items-center gap-1 leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-press-500 motion-safe:animate-pulse flex-shrink-0" />
                <span className="text-[10px] font-bold text-press-400 uppercase tracking-widest">Breaking</span>
              </span>
            )}
          </div>

          {/* Headline */}
          <p className={`text-sm font-medium leading-snug mb-2 transition-colors ${
            isSkipped ? 'line-through text-ink-500' : isApproved ? 'text-ink-200' : 'text-white'
          }`}>
            {pick.title}
          </p>

          {/* Expanded summary — fades in */}
          {isActive && isPending && (
            <p className="text-ink-300 text-xs leading-relaxed mb-3 border-l-2 border-ink-600/60 pl-3 italic">
              {pick.summary}
            </p>
          )}

          {/* Status / Actions */}
          {isPending ? (
            <div className="flex items-center gap-2 flex-wrap">
              {isActive ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onApprove(pick.id); }}
                    className="flex items-center gap-1.5 bg-emerald-800/40 hover:bg-emerald-700/50 active:bg-emerald-800/60 border border-emerald-600/30 hover:border-emerald-500/50 text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-800"
                  >
                    <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSkip(pick.id); }}
                    className="flex items-center gap-1.5 bg-press-900/30 hover:bg-press-800/40 active:bg-press-900/50 border border-press-700/30 hover:border-press-600/50 text-press-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-press-400 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-800"
                  >
                    <HiOutlineXCircle className="w-3.5 h-3.5" />
                    Skip
                  </button>
                  <a
                    href={pick.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-ink-500 hover:text-ink-300 text-xs transition-colors ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded"
                  >
                    Source <HiOutlineArrowTopRightOnSquare className="w-3 h-3" />
                  </a>
                </>
              ) : (
                <span className="text-ink-600 text-xs flex items-center gap-1.5">
                  <HiOutlineClock className="w-3 h-3 flex-shrink-0" />
                  Pending review
                </span>
              )}
            </div>
          ) : isApproved ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                <HiOutlineCheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Approved
              </span>
              <a
                href={`/editor/new?scanPick=${pick.id}&headline=${encodeURIComponent(pick.title)}&source=${encodeURIComponent(pick.source)}&sourceUrl=${encodeURIComponent(pick.url)}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 bg-ink-700 hover:bg-ink-600 active:bg-ink-750 border border-white/10 hover:border-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-800"
              >
                <HiOutlinePencilSquare className="w-3.5 h-3.5" />
                Draft Article
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-ink-600 text-xs">
                <HiOutlineXCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Skipped
                {pick.skipReason && (
                  <span className="text-ink-700">
                    · {SKIP_REASONS.find((r) => r.value === pick.skipReason)?.label ?? pick.skipReason}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Expand / collapse toggle — min 32px touch target */}
        {isPending && (
          <button
            onClick={(e) => { e.stopPropagation(); onActivate(); }}
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 -mr-1 rounded-lg text-ink-600 hover:text-ink-300 hover:bg-ink-700/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            aria-label={isActive ? 'Collapse' : 'Expand'}
          >
            {isActive
              ? <HiOutlineChevronUp className="w-4 h-4" />
              : <HiOutlineChevronDown className="w-4 h-4" />
            }
          </button>
        )}
      </div>
    </div>
  );
}

// ── Run List Item ─────────────────────────────────────────────────────────────

function RunListItem({
  run,
  isSelected,
  onClick,
}: {
  run: ScanRun;
  isSelected: boolean;
  onClick: () => void;
}) {
  const total = run.pickedCount ?? 0;
  const processed = run.approved + run.skipped;
  const progress = total > 0 ? Math.round((processed / total) * 100) : 0;
  const allDone = total > 0 && run.pending === 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20
        ${isSelected
          ? 'bg-ink-700/80 border border-white/10 shadow-sm'
          : 'hover:bg-ink-800/60 border border-transparent hover:border-white/5'}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-ink-200'}`}>
            {formatRunTime(run.createdAt)}
          </p>
          <p className="text-ink-500 text-[10px] mt-0.5">{timeAgo(run.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className={`text-xs font-bold ${run.pending > 0 ? 'text-amber-400' : 'text-ink-500'}`}>
            {total} picks
          </span>
          {run.pending > 0 && (
            <span className="text-[10px] text-amber-500/70">{run.pending} pending</span>
          )}
          {allDone && (
            <span className="text-[10px] text-emerald-600">done</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mt-2 h-px bg-ink-700/80 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-600' : 'bg-emerald-700'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </button>
  );
}

// ── Keyboard Key Badge ────────────────────────────────────────────────────────

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center text-[10px] font-mono text-ink-500 bg-ink-800/80 border border-white/10 rounded px-1.5 py-0.5 leading-none">
      {children}
    </kbd>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [runs, setRuns] = useState<ScanRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [picks, setPicks] = useState<ScanPick[]>([]);
  const [activePickId, setActivePickId] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingPicks, setLoadingPicks] = useState(false);
  const [skipModalPickId, setSkipModalPickId] = useState<string | null>(null);
  const [newScanBanner, setNewScanBanner] = useState(false);
  const [newScanId, setNewScanId] = useState<string | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated' && session.user.role !== 'ADMIN') router.push('/dashboard');
  }, [status, session, router]);

  // Load scan runs
  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/scanner/runs');
      if (!res.ok) return;
      const data = await res.json();
      setRuns(data.runs ?? []);
      if (!selectedRunId && data.runs?.length > 0) {
        setSelectedRunId(data.runs[0].id);
      }
    } finally {
      setLoadingRuns(false);
    }
  }, [selectedRunId]);

  useEffect(() => {
    if (status === 'authenticated') loadRuns();
  }, [status, loadRuns]);

  // Load picks for selected run
  useEffect(() => {
    if (!selectedRunId) return;
    setLoadingPicks(true);
    setActivePickId(null);
    fetch(`/api/scanner/runs/${selectedRunId}/picks`)
      .then((r) => r.json())
      .then((d) => setPicks(d.picks ?? []))
      .catch(() => {})
      .finally(() => setLoadingPicks(false));
  }, [selectedRunId]);

  // SSE — new scan notifications
  useEffect(() => {
    if (status !== 'authenticated') return;
    const es = new EventSource('/api/scanner/events');
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new-scan') {
          setNewScanId(data.scanRunId);
          setNewScanBanner(true);
        }
      } catch {}
    };
    return () => es.close();
  }, [status]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const pendingPicks = picks.filter((p) => p.status === 'PENDING');
      const currentIdx = pendingPicks.findIndex((p) => p.id === activePickId);

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = pendingPicks[currentIdx + 1] ?? pendingPicks[0];
        if (next) {
          setActivePickId(next.id);
          const idx = picks.findIndex((p) => p.id === next.id);
          cardRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = pendingPicks[currentIdx - 1] ?? pendingPicks[pendingPicks.length - 1];
        if (prev) {
          setActivePickId(prev.id);
          const idx = picks.findIndex((p) => p.id === prev.id);
          cardRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else if (e.key === 'a' && activePickId) {
        e.preventDefault();
        handleApprove(activePickId);
      } else if (e.key === 's' && activePickId) {
        e.preventDefault();
        setSkipModalPickId(activePickId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, activePickId]);

  // Optimistic update helpers
  const updatePickStatus = (pickId: string, updates: Partial<ScanPick>) => {
    setPicks((prev) => prev.map((p) => (p.id === pickId ? { ...p, ...updates } : p)));
    setRuns((prev) =>
      prev.map((r) => {
        if (r.id !== selectedRunId) return r;
        const oldPick = picks.find((p) => p.id === pickId);
        const wasApproved = oldPick?.status === 'APPROVED';
        const wasSkipped = oldPick?.status === 'SKIPPED';
        const isNowApproved = updates.status === 'APPROVED';
        const isNowSkipped = updates.status === 'SKIPPED';
        return {
          ...r,
          approved: r.approved + (isNowApproved ? 1 : 0) - (wasApproved ? 1 : 0),
          skipped: r.skipped + (isNowSkipped ? 1 : 0) - (wasSkipped ? 1 : 0),
          pending: r.pending - (isNowApproved || isNowSkipped ? 1 : 0) + (wasApproved || wasSkipped ? 1 : 0),
        };
      })
    );
  };

  const handleApprove = async (pickId: string) => {
    const snapshot = picks;
    updatePickStatus(pickId, { status: 'APPROVED', processedAt: new Date().toISOString() });
    setActivePickId(null);
    try {
      const res = await fetch(`/api/scanner/picks/${pickId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
    } catch {
      setPicks(snapshot);
    }
  };

  const handleSkipConfirm = async (pickId: string, reason: string) => {
    const snapshot = picks;
    setSkipModalPickId(null);
    updatePickStatus(pickId, { status: 'SKIPPED', skipReason: reason, processedAt: new Date().toISOString() });
    setActivePickId(null);
    try {
      const res = await fetch(`/api/scanner/picks/${pickId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SKIPPED', skipReason: reason }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
    } catch {
      setPicks(snapshot);
    }
  };

  const handleNewScanClick = async () => {
    setNewScanBanner(false);
    await loadRuns();
    if (newScanId) setSelectedRunId(newScanId);
    setNewScanId(null);
  };

  if (status === 'loading' || loadingRuns) {
    return (
      <AppShell flush>
        <div className="min-h-screen bg-ink-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="w-6 h-6" />
            <p className="text-ink-600 text-sm font-mono">Initializing scanner...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const selectedRun = runs.find((r) => r.id === selectedRunId);
  const pendingCount = picks.filter((p) => p.status === 'PENDING').length;
  const approvedCount = picks.filter((p) => p.status === 'APPROVED').length;
  const skippedCount = picks.filter((p) => p.status === 'SKIPPED').length;

  return (
    <AppShell flush>
      <div className="min-h-screen bg-ink-950 flex flex-col">

        {/* New scan notification banner */}
        {newScanBanner && (
          <div className="bg-amber-900/80 border-b border-amber-700/50 text-amber-200 text-sm font-medium px-4 py-2.5 flex items-center justify-between z-10 backdrop-blur-sm">
            <span className="flex items-center gap-2">
              <HiOutlineBellAlert className="w-4 h-4 flex-shrink-0" />
              New scan results are ready
            </span>
            <button
              onClick={handleNewScanClick}
              className="text-amber-300 hover:text-amber-100 underline underline-offset-2 hover:no-underline transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
            >
              Load now
            </button>
          </div>
        )}

        {/* Top status bar */}
        <div className="border-b border-white/5 px-4 py-2 flex items-center gap-3 bg-ink-900/40 flex-shrink-0">
          {/* Live indicator + brand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-press-500/30 motion-safe:animate-ping" style={{ animationDuration: '2.5s' }} />
              <HiOutlineSignal className="w-4 h-4 text-press-400 relative" />
            </div>
            <span className="text-xs font-bold tracking-widest uppercase text-press-400">M3 Scanner</span>
          </div>

          <span className="w-px h-3 bg-white/10 flex-shrink-0" />

          {selectedRun ? (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-ink-500 text-xs truncate hidden sm:block">
                {formatRunTime(selectedRun.createdAt)}
              </span>
              <span className="w-px h-3 bg-white/10 flex-shrink-0 hidden sm:block" />
              <span className="text-ink-400 text-xs flex-shrink-0">
                <span className="text-ink-200 font-semibold">{selectedRun.pickedCount ?? 0}</span> picks
              </span>
              <span className="text-emerald-500 text-xs flex-shrink-0">
                <span className="font-semibold">{approvedCount}</span> approved
              </span>
              {pendingCount > 0 && (
                <span className="text-amber-400 text-xs font-semibold flex-shrink-0">
                  {pendingCount} pending
                </span>
              )}
            </div>
          ) : (
            <span className="text-ink-600 text-xs">No scans yet</span>
          )}

          {/* Keyboard shortcut hints */}
          <div className="ml-auto hidden lg:flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1">
              <Key>J</Key><Key>K</Key>
              <span className="text-ink-600 text-[10px] ml-0.5">navigate</span>
            </div>
            <span className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1">
              <Key>A</Key>
              <span className="text-ink-600 text-[10px] ml-0.5">approve</span>
            </div>
            <div className="flex items-center gap-1">
              <Key>S</Key>
              <span className="text-ink-600 text-[10px] ml-0.5">skip</span>
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: Scan run history */}
          <aside className="w-56 flex-shrink-0 border-r border-white/5 bg-ink-900/20 overflow-y-auto hidden md:flex flex-col">
            <div className="px-3 pt-3 pb-1.5">
              <p className="text-ink-600 text-[10px] font-semibold uppercase tracking-widest">Scan History</p>
            </div>
            <div className="px-2 pb-3 flex-1">
              {runs.length === 0 ? (
                <p className="text-ink-700 text-xs px-2 pt-4">No scans recorded yet.</p>
              ) : (
                runs.map((run) => (
                  <RunListItem
                    key={run.id}
                    run={run}
                    isSelected={run.id === selectedRunId}
                    onClick={() => setSelectedRunId(run.id)}
                  />
                ))
              )}
            </div>
          </aside>

          {/* Right: Picks feed */}
          <main className="flex-1 overflow-y-auto">
            {loadingPicks ? (
              <div className="flex items-center justify-center h-40 gap-3">
                <Spinner className="w-4 h-4" />
                <span className="text-ink-600 text-sm font-mono">Loading picks...</span>
              </div>
            ) : !selectedRunId ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8 py-24">
                <div className="w-14 h-14 rounded-2xl bg-ink-900/60 border border-white/5 flex items-center justify-center mb-4">
                  <HiOutlineSignal className="w-7 h-7 text-ink-700" />
                </div>
                <p className="text-ink-500 text-sm font-medium">No scan selected</p>
                <p className="text-ink-700 text-xs mt-1.5">Run the scanner to see results here</p>
              </div>
            ) : picks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8 py-24">
                <div className="w-14 h-14 rounded-2xl bg-ink-900/60 border border-white/5 flex items-center justify-center mb-4">
                  <HiOutlineSignal className="w-7 h-7 text-ink-700" />
                </div>
                <p className="text-ink-500 text-sm font-medium">No picks in this scan</p>
                <p className="text-ink-700 text-xs mt-1.5">The scanner found no qualifying stories</p>
              </div>
            ) : (
              <div className="p-4 max-w-3xl mx-auto">
                {/* Mobile: current run info */}
                {selectedRun && (
                  <div className="md:hidden mb-3 flex items-center gap-2 text-xs text-ink-500">
                    <HiOutlineSignal className="w-3.5 h-3.5" />
                    {formatRunTime(selectedRun.createdAt)}
                  </div>
                )}

                {/* Picks */}
                {picks.map((pick, idx) => (
                  <div key={pick.id} ref={(el) => { cardRefs.current[idx] = el; }}>
                    <PickCard
                      pick={pick}
                      isActive={activePickId === pick.id}
                      onActivate={() => setActivePickId(activePickId === pick.id ? null : pick.id)}
                      onApprove={handleApprove}
                      onSkip={(id) => setSkipModalPickId(id)}
                    />
                  </div>
                ))}

                {/* All done state */}
                {pendingCount === 0 && picks.length > 0 && (
                  <div className="mt-6 text-center py-8 border border-white/5 rounded-2xl bg-ink-900/20">
                    <div className="w-12 h-12 rounded-full bg-emerald-900/40 border border-emerald-700/30 flex items-center justify-center mx-auto mb-3">
                      <HiOutlineSparkles className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-ink-200 text-sm font-semibold">All picks reviewed</p>
                    <p className="text-ink-500 text-xs mt-1.5">
                      {approvedCount} approved
                      {skippedCount > 0 && <> · {skippedCount} skipped</>}
                    </p>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Skip modal */}
      {skipModalPickId && (
        <SkipModal
          pickId={skipModalPickId}
          onConfirm={handleSkipConfirm}
          onCancel={() => setSkipModalPickId(null)}
        />
      )}
    </AppShell>
  );
}
