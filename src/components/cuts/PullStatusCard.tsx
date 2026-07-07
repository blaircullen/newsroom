'use client';

import { useEffect, useState } from 'react';
import { HiOutlineArrowDownTray, HiOutlineScissors, HiOutlineArrowPath, HiOutlineExclamationTriangle, HiOutlineChevronDown } from 'react-icons/hi2';
import type { CutPullDTO, PullStage } from '@/lib/cuts';
import { PULL_STAGE_CONFIG, PIPELINE_STAGES, formatEt, formatElapsed, formatMs } from '@/lib/cuts';

interface PullStatusCardProps {
  pull: CutPullDTO;
  onRetry: (pullId: string) => void;
  onSendToTrim: (pullId: string) => void; // v1: records intent; real trimmer pending (design doc §6)
  onDownloadRaw: (pullId: string) => void;
}

/** Live mm:ss counter -- the studio-clock tick that makes a long wait legible. */
function ElapsedTimecode({ since, running }: { since: string; running: boolean }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return (
    <span className={`font-mono text-lg tabular-nums tracking-tight ${running ? 'text-white' : 'text-ink-400'}`} aria-hidden>
      {formatElapsed(since)}
    </span>
  );
}

function StageRail({ stage }: { stage: PullStage }) {
  const activeIdx = PIPELINE_STAGES.indexOf(stage === 'FAILED' ? 'RENDERING' : stage);
  return (
    <ol className="flex items-center gap-0 mt-3" aria-label="Pull progress">
      {PIPELINE_STAGES.map((s, i) => {
        const cfg = PULL_STAGE_CONFIG[s];
        const done = i < activeIdx;
        const current = i === activeIdx && stage !== 'FAILED';
        return (
          <li key={s} className="flex items-center flex-1 last:flex-none min-w-0">
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors duration-200 ${
                  done ? 'bg-emerald-400' : current ? `${cfg.dotClass} motion-safe:animate-pulse` : 'bg-white/15'
                }`}
                aria-hidden
              />
              <span
                className={`text-[10px] font-medium truncate max-w-[72px] ${
                  current ? cfg.textClass : done ? 'text-ink-300' : 'text-ink-500'
                }`}
              >
                {cfg.label}
              </span>
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <span
                className={`h-px flex-1 mx-1 mb-4 transition-colors duration-200 ${done ? 'bg-emerald-400/50' : 'bg-white/10'}`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function PullStatusCard({ pull, onRetry, onSendToTrim, onDownloadRaw }: PullStatusCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const cfg = PULL_STAGE_CONFIG[pull.stage];
  const isLive = !['RAW_READY', 'FAILED'].includes(pull.stage);
  const c = pull.candidate;

  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4" aria-label={`Pull: ${c.headline}, status ${cfg.label}`}>
      {/* Header: timecode + identity */}
      <div className="flex items-start gap-3">
        <ElapsedTimecode since={pull.createdAt} running={isLive} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug line-clamp-1">{c.headline}</p>
          <p className="text-[11px] text-ink-400 mt-0.5">
            {c.station} · {c.show} · {formatEt(c.airDate)}
          </p>
        </div>
        {/* Live region: screen readers hear stage changes without the ticking clock */}
        <span role="status" aria-live="polite" className="sr-only">
          {cfg.label}
        </span>
      </div>

      {/* ---- FAILED ---- */}
      {pull.stage === 'FAILED' && pull.error && (
        <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/30 p-3">
          <div className="flex items-start gap-2">
            <HiOutlineExclamationTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-300">Failed while {PULL_STAGE_CONFIG[pull.error.stage].label.toLowerCase()}</p>
              {/* Verbatim backend cause -- never a swallowed generic */}
              <p className="text-xs text-red-300/80 mt-1 break-words">{pull.error.message}</p>
            </div>
            <button
              onClick={() => onRetry(pull.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30
                text-red-200 text-xs font-semibold transition-colors flex-shrink-0
                focus:outline-none focus:ring-2 focus:ring-red-400/50"
            >
              <HiOutlineArrowPath className="w-3.5 h-3.5" aria-hidden /> Retry
            </button>
          </div>
        </div>
      )}

      {/* ---- IN FLIGHT: the rail ---- */}
      {isLive && (
        <>
          <StageRail stage={pull.stage} />
          <p className="mt-2 text-xs text-ink-400">{cfg.hint}</p>
        </>
      )}

      {/* ---- RAW READY ---- */}
      {pull.stage === 'RAW_READY' && (
        <div className="mt-3">
          {/* The amber band: the raw-untrimmed truth, impossible to miss */}
          <div className="rounded-lg bg-amber-500/15 border border-amber-400/40 px-3 py-2.5 flex items-center gap-2.5">
            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-ink-950 text-[10px] font-black tracking-wide flex-shrink-0">RAW</span>
            <p className="text-xs text-amber-200 leading-snug">
              Full untrimmed segment
              {pull.rawDurationS != null && (
                <>
                  {' '}
                  — <span className="font-mono font-semibold">
                    {Math.floor(pull.rawDurationS / 60)}m {Math.floor(pull.rawDurationS % 60)}s
                  </span>
                </>
              )}
              . Intended cut:{' '}
              <span className="font-mono font-semibold">
                {formatMs(pull.intendedStartMs)}–{formatMs(pull.intendedEndMs)}
              </span>{' '}
              — trim before use.
            </p>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => onSendToTrim(pull.id)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                bg-press-500 hover:bg-press-600 text-white text-sm font-semibold transition-colors
                focus:outline-none focus:ring-2 focus:ring-press-500/50 focus:ring-offset-2 focus:ring-offset-ink-900"
            >
              <HiOutlineScissors className="w-4 h-4" aria-hidden /> Send to trim
            </button>
            <button
              onClick={() => onDownloadRaw(pull.id)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                bg-white/5 hover:bg-white/10 border border-white/15 text-ink-100 text-sm font-medium transition-colors
                focus:outline-none focus:ring-2 focus:ring-press-500/50"
            >
              <HiOutlineArrowDownTray className="w-4 h-4" aria-hidden /> Download raw MP4
            </button>
            <button
              onClick={() => setDetailsOpen((o) => !o)}
              className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg
                text-ink-400 hover:text-white text-xs font-medium transition-colors
                focus:outline-none focus:ring-2 focus:ring-press-500/50"
              aria-expanded={detailsOpen}
            >
              Details <HiOutlineChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${detailsOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          </div>

          {detailsOpen && (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs rounded-lg bg-white/[0.03] border border-white/10 p-3">
              <dt className="text-ink-500">Transcript excerpt</dt>
              <dd className="text-ink-200 col-span-2 sm:col-span-1 line-clamp-3">{c.summary}</dd>
              <dt className="text-ink-500">Pulled</dt>
              <dd className="text-ink-200">{formatEt(pull.updatedAt)}</dd>
              <dt className="text-ink-500">Sidecar</dt>
              <dd className="text-ink-200 font-mono text-[10px]">raw_untrimmed: true</dd>
            </dl>
          )}
        </div>
      )}
    </article>
  );
}
