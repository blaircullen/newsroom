// Shared types for the "Broadcast Cuts" feature (Grabien NewsBase clip pulls).
// Mirrors the grabien-api wrapper's real shapes -- see
// docs/grabien-clipper-feature-design.md §4.1/§6. Taken from the design
// doc's prototype almost verbatim; the API routes in src/app/api/cuts/
// implement the server side of this contract.

export interface CutSearchFilters {
  person?: string;
  show?: string;
  network?: string;
  date?: string; // YYYY-MM-DD (ET)
  timeWindow?: string; // e.g. "20:00-23:00" (ET)
}

export interface CutCandidate {
  id: string; // Grabien fileid, as a string -- required to continue past ambiguity
  station: string;
  show: string;
  airDate: string; // ISO -- ALWAYS displayed in ET per house rule
  headline: string;
  summary: string;
  thumbnailUrl: string | null;
  durationS: number | null;
}

// Pipeline stages -- server-persisted on the CutPull row, polled by the client.
// Matches the wrapper's ClipJob.stage vocabulary exactly (grabien-api's
// src/grabien_api/wrapper/jobs.py) -- no translation layer needed.
export type PullStage =
  | 'QUEUED' // waiting for the shared single-seat Grabien line
  | 'SUBMITTING' // render job being submitted
  | 'RENDERING' // Grabien-side render (the minutes-long stage)
  | 'DOWNLOADING' // mp4 transferring to Newsroom storage
  | 'RAW_READY' // full untrimmed segment on disk + sidecar metadata
  | 'FAILED';

export interface CutPullDTO {
  id: string;
  candidate: CutCandidate;
  stage: PullStage;
  intendedStartMs: number;
  intendedEndMs: number;
  rawDurationS: number | null;
  rawUntrimmed: true; // literal: every Grabien pull is raw (backend-confirmed)
  mp4Path: string | null;
  error: { stage: PullStage; message: string } | null; // verbatim backend cause -- never swallowed
  createdAt: string;
  updatedAt: string;
}

export const PULL_STAGE_CONFIG: Record<
  PullStage,
  { label: string; hint: string; dotClass: string; textClass: string }
> = {
  QUEUED: {
    label: 'Queued',
    hint: 'Grabien is a shared line — one pull renders at a time.',
    dotClass: 'bg-ink-400',
    textClass: 'text-ink-300',
  },
  SUBMITTING: {
    label: 'Sent',
    hint: 'Render job submitted to Grabien.',
    dotClass: 'bg-sky-400',
    textClass: 'text-sky-300',
  },
  RENDERING: {
    label: 'Rendering',
    hint: 'Grabien renders usually take 2–10 minutes. Safe to leave this page.',
    dotClass: 'bg-press-500',
    textClass: 'text-press-400',
  },
  DOWNLOADING: {
    label: 'Downloading',
    hint: 'Pulling the finished file into Newsroom.',
    dotClass: 'bg-violet-400',
    textClass: 'text-violet-300',
  },
  RAW_READY: {
    label: 'Raw ready',
    hint: 'Full untrimmed segment — needs a trim pass before use.',
    dotClass: 'bg-emerald-400',
    textClass: 'text-emerald-300',
  },
  FAILED: {
    label: 'Failed',
    hint: '',
    dotClass: 'bg-red-500',
    textClass: 'text-red-400',
  },
};

export const PIPELINE_STAGES: PullStage[] = ['QUEUED', 'SUBMITTING', 'RENDERING', 'DOWNLOADING', 'RAW_READY'];

export function formatEt(iso: string): string {
  return (
    new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }) + ' ET'
  );
}
