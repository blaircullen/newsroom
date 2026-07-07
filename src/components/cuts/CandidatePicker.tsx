'use client';

import { HiOutlineTv, HiArrowRight } from 'react-icons/hi2';
import type { CutCandidate } from '@/lib/cuts';
import { formatEt } from '@/lib/cuts';

interface CandidatePickerProps {
  candidates: CutCandidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

function formatDuration(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  return `${m}m ${String(Math.floor(s % 60)).padStart(2, '0')}s`;
}

export default function CandidatePicker({ candidates, selectedId, onSelect, onConfirm, isSubmitting }: CandidatePickerProps) {
  if (candidates.length === 0) return null;

  return (
    <section aria-labelledby="candidates-heading" className="mt-8">
      <div className="flex items-baseline justify-between mb-4">
        <h2 id="candidates-heading" className="text-sm font-semibold text-white">
          {candidates.length === 1 ? '1 segment found — confirm it’s the right one' : `${candidates.length} segments match — pick the right one`}
        </h2>
        <span className="text-xs text-ink-400">Air times shown in ET</span>
      </div>

      <div role="radiogroup" aria-label="Matching broadcast segments" className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((c) => {
          const isSelected = c.id === selectedId;
          return (
            <button
              key={c.id}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(c.id)}
              className={`text-left rounded-xl overflow-hidden border transition-all duration-150 group
                focus:outline-none focus:ring-2 focus:ring-press-500/60 focus:ring-offset-2 focus:ring-offset-ink-900
                ${
                  isSelected
                    ? 'border-press-500 bg-press-500/10 shadow-card-hover'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                }`}
            >
              <div className="relative aspect-video bg-ink-800">
                {c.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Grabien CDN host not in next.config images
                  <img src={c.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-500">
                    <HiOutlineTv className="w-8 h-8" aria-hidden />
                  </div>
                )}
                <span className="absolute left-2 bottom-2 px-1.5 py-0.5 rounded bg-ink-950/85 text-[10px] font-bold text-white tracking-wide">
                  {c.station}
                </span>
                <span className="absolute right-2 bottom-2 px-1.5 py-0.5 rounded bg-ink-950/85 text-[10px] font-mono text-ink-200">
                  {formatDuration(c.durationS)}
                </span>
                {isSelected && (
                  <span className="absolute inset-0 ring-2 ring-inset ring-press-500 rounded-none pointer-events-none" aria-hidden />
                )}
              </div>

              <div className="p-3">
                <p className="text-[11px] font-medium text-ink-400 mb-1">
                  {c.show} · {formatEt(c.airDate)}
                </p>
                <p
                  className={`text-sm leading-snug line-clamp-2 transition-colors ${
                    isSelected ? 'text-white' : 'text-ink-100 group-hover:text-white'
                  }`}
                >
                  {c.headline}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 sm:static fixed bottom-[88px] left-3 right-3 z-40 sm:bottom-auto sm:left-auto sm:right-auto sm:z-auto">
        <button
          onClick={onConfirm}
          disabled={!selectedId || isSubmitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl
            bg-press-500 hover:bg-press-600 text-white font-semibold text-sm
            shadow-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors
            focus:outline-none focus:ring-2 focus:ring-press-500/60 focus:ring-offset-2 focus:ring-offset-ink-900"
        >
          {isSubmitting ? 'Starting pull…' : 'Pull this segment'}
          {!isSubmitting && <HiArrowRight className="w-4 h-4" aria-hidden />}
        </button>
        <p className="mt-2 text-[11px] text-ink-400 text-center sm:text-left">
          Pulls the <span className="text-amber-300 font-medium">full raw segment</span> — you’ll trim it after download.
        </p>
      </div>
    </section>
  );
}
