# Broadcast Cuts — Grabien Clip Acquisition for Newsroom

**Status: DESIGN + PROTOTYPE CODE ONLY. Nothing in this doc is wired into the app yet. No files outside this doc were modified.**

Design pass 2026-07-06. Grounded in the real backend (`~/projects/grabien-api`, skill `grabien-newsbase-clipper`) and the real Newsroom codebase (files cited inline). Frontend-design + impeccable skills were applied for aesthetic direction and the UX-polish pass.

---

## 1. Design rationale

### What this feature actually is (and what it must never pretend to be)

Grabien is a **raw acquisition source, not a trimmer** — live testing confirmed a requested 10-second trim came back as the full ~503s source segment. So the product being designed is **"pull the raw segment now, trim it next"** — never "get a finished clip." Every screen keeps that honest. The completed state is deliberately named **"Raw segment ready — needs trim"**, never "Clip ready."

The flow has four real phases with real waiting time:

```
SEARCH (conversational)  →  PICK (human disambiguation, never auto)  →
PULL (submit render → Grabien renders for MINUTES → download)  →  RAW READY → hand off to trim
```

### Naming

**"Cuts"** — route `/cuts`, nav label "Broadcast Cuts". "Cuts" is the newsroom word for broadcast excerpts ("search for cuts" was the original ask), it's short enough for the mobile bottom nav, and it doesn't overpromise trimming the way "Clips" would.

### Grounding in the codebase (confirmed by reading, not guessed)

| Convention | Source | How this design uses it |
|---|---|---|
| `NavItem { href, label, icon, showFor }`, no badge concept | `src/lib/navigation.ts:11-17` | Extended with optional `badge` (§3.1) |
| Sidebar renders a right-aligned pill in the nav row (review count) | `src/components/layout/Sidebar.tsx:278-283` | Same slot renders the BETA badge |
| BottomNav does **not** consume `navigation.ts` — it's a hardcoded 3-tab controller (`home/hot/analytics`) driven by dashboard-local state + `?tab=` | `src/components/layout/BottomNav.tsx:18-22`, `src/app/dashboard/page.tsx:54,473` | Extended with a 4th route-tab (§3.3) — flagged as a real structural divergence, handled explicitly |
| ADMIN-gated API: `getServerSession(authOptions)` + `session.user.role !== 'ADMIN'` → 401 | `src/app/api/scanner/runs/route.ts:12-16` | All `/api/cuts/*` routes copy this gate |
| External-search API: session gate, 502 with real error message on upstream failure | `src/app/api/getty/search/route.ts` | `/api/cuts/search` mirrors it (errors carry the upstream message — never a swallowed `null`, per house rule) |
| SSE with 25s keepalive exists (`scanner/events`), but simple `setInterval` polling is the dominant client pattern (Sidebar InsightsPanel polls every 5 min; dashboard review count every 60s) | `Sidebar.tsx:53-85,224-238` | Pull status polls every 10s while a pull is live — SSE is a later upgrade, not required for v1 |
| All pages `'use client'`; client-side role redirect like scanner (`status==='authenticated' && role!=='ADMIN' → /dashboard`) | `src/app/scanner/page.tsx:425-428`, `CLAUDE.md` | `/cuts` page uses the identical gate |
| Tokens: `ink-*` navy, `press-*` crimson (#D42B2B), `paper-*`; fonts Playfair (`font-display`), Source Sans 3 (body), JetBrains Mono (`font-mono`); `darkMode: 'class'`; `shadow-card/-hover/-elevated` | `tailwind.config.ts:48-103` | No invented palette. Amber (already the codebase's "needs attention" color — `REVISION_REQUESTED` in `StatusBadge.tsx`, Top Posts rank chips) is reserved exclusively for the RAW/untrimmed warning |
| Status vocabulary: `STATUS_CONFIG` map of label + desktop class + mobile gradient class | `src/components/ui/StatusBadge.tsx` | `PULL_STAGE_CONFIG` follows the same shape (§4.4) |
| Skeletons not spinners: `Skeleton/SkeletonText/SkeletonCard` exist | `src/components/ui/Skeleton.tsx` (per CLAUDE.md) | Search results load as skeleton cards |
| Reduced motion: codebase already uses `motion-safe:animate-pulse` | `src/app/scanner/page.tsx:235` | All pulse/ticker motion is `motion-safe:` gated |

### Key finding: **Newsroom has no trim/clip editor today**

Confirmed by search: `grep -rn "trim("` in `src/` finds only string `.trim()` calls; "clip" matches are `clipboard`/`line-clamp`; the only video-adjacent code is TipTap `MediaEmbed.tsx` (embeds, not editing). The "existing transcript-based clip pipeline" referenced by the backend skill doc **lives outside this repo** (it's the local AI-timestamps + ffmpeg cut workflow Blair runs by hand/via Claude). So the "Send to trim" handoff in this design is a **forward reference**: v1 ships it as a marked-pending action that records intent (the sidecar's intended trim bounds are preserved and displayed), and the actual in-app trimmer (or a webhook to the external pipeline) is on the backend-work list (§6). The UI is designed so that when a trimmer exists, only the button's `onClick` changes.

### Aesthetic direction (frontend-design pass)

Newsroom already has a strong editorial identity: navy ink, crimson press accent, Playfair display. Product register (impeccable): **restrained**, the tool disappears into the task — no new palette, no display fonts in labels, skeletons not spinners, modals avoided (disambiguation is inline, not a modal).

**The one signature element** — where the boldness budget is spent — is the **Pull Rail**: a broadcast-style pipeline strip for each in-flight pull, with a live **mono timecode elapsed counter** (JetBrains Mono, already in the config) ticking like a studio clock, and stage nodes that fill left-to-right. It's drawn from the subject's own world (control-room signal chains, tape timecode), it makes a multi-minute wait legible instead of anxious, and it works identically as a horizontal rail on desktop and a stacked rail on mobile. Everything else stays quiet.

**Async honesty rules** (impeccable critique applied):
- Never an indeterminate spinner for a minutes-long wait. The rail always shows *which* stage you're in, *how long* it's been, and *what's normal* ("renders usually take 2–10 minutes").
- Pulls are server-persisted (new `CutPull` table) so the user can leave the page; the sidebar badge slot shows the live in-flight count (same mechanic as the review-count pill), and the bottom-nav Cuts tab shows a pulsing dot while a pull is rendering.
- Failure states name the cause verbatim from the backend (expired session vs. render timeout vs. download failure) with a stage-appropriate retry — never a generic "something went wrong."
- The shared single-seat Grabien account is surfaced as a first-class state: "Grabien line is busy — your pull is queued behind 1 other." One concurrent render, enforced server-side, explained in the UI. Session-expired is an admin-facing amber banner ("Grabien session expired — re-harvest from a logged-in browser"), not a silent failure.
- Single search result still requires an explicit "Pull this segment" click (pre-selected, never auto-submitted) — the never-auto-pick rule applies even to n=1.

### Mobile (explicitly designed, not squeezed)

- Search: single full-width conversational input; filters live in a slide-up sheet (thumb reach), not a cramped inline row.
- Candidates: full-width cards, thumbnail on top (16:9), tap-to-select whole card, sticky bottom "Pull this segment" confirm bar above the BottomNav (respecting `pb-[env(safe-area-inset-bottom)]` like BottomNav itself).
- Pull rail: vertical stage list with the timecode counter as the card header; stages collapse to dots + current-stage label on the compact list view.
- The RAW warning is a full-width amber band on mobile — impossible to miss above the fold of the ready card.

---

## 2. Screen flow

```
/cuts
┌────────────────────────────────────────────────────────────────┐
│ Broadcast Cuts                                   [BETA]        │
│ "Find a broadcast segment the way you'd describe it."          │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 🔍  Hannity on Fox News last Tuesday, opening monologue    │ │
│ └────────────────────────────────────────────────────────────┘ │
│ [Person: Hannity ×] [Network: Fox News ×] [Date: Jul 1 ×] +   │
│                                                                │
│ ── Results (4 segments) — pick the right one ────────────────  │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│ │ [thumb]      │ │ [thumb]      │ │ [thumb]      │  ...       │
│ │ FNC · 9:02p  │ │ FNC · 9:14p  │ │ FNC · 9:47p  │            │
│ │ headline…    │ │ headline…    │ │ headline…    │            │
│ │ ( ) select   │ │ (•) selected │ │ ( ) select   │            │
│ └──────────────┘ └──────────────┘ └──────────────┘            │
│                     [ Pull this segment → ]                    │
│                                                                │
│ ── Active pulls ─────────────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 04:37  Hannity · FNC · Jul 1 9:14 PM ET                    │ │
│ │ ●──────●──────◐──────○──────○                              │ │
│ │ Queued  Sent  Rendering  Downloading  Raw ready            │ │
│ │ Rendering at Grabien — usually 2–10 min. Safe to leave.    │ │
│ └────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ ✔ RAW READY — FULL SEGMENT, UNTRIMMED (8m 23s)             │ │
│ │ ▓▓ amber band: needs trim to 0:41–0:51 (intended bounds) ▓▓│ │
│ │ [ Send to trim → ]   [ Download raw MP4 ]   [Details ▾]    │ │
│ └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

States covered: initial/empty (teaching copy + 3 example queries as tappable chips), searching (skeleton cards), zero results (suggest loosening filters, name which filter is narrowest), ambiguous (pick required), single result (pre-selected, still confirmed), queued-behind-busy-line, rendering, downloading, raw-ready, failed-per-stage, Grabien-session-expired (page-level amber banner, admin action).

---

## 3. Navigation code

### 3.1 `src/lib/navigation.ts` — NavItem badge extension + Cuts entry

```ts
import {
  HiOutlineNewspaper,
  HiOutlineClipboardDocumentCheck,
  HiOutlineUserGroup,
  HiOutlineGlobeAlt,
  HiOutlineChartBar,
  HiOutlineRss,
  HiOutlineScissors,
} from 'react-icons/hi2';
import { IconType } from 'react-icons';

export interface NavBadge {
  label: string;              // 'BETA' | 'NEW' — display text
  variant: 'new' | 'beta';    // 'new' = press crimson, 'beta' = amber (experimental)
}

export interface NavItem {
  href: string;
  label: string;
  icon: IconType;
  /** Function to determine if this item should be shown */
  showFor: (role: string) => boolean;
  /** Optional new/experimental marker, rendered by Sidebar + BottomNav */
  badge?: NavBadge;
}

export const navItems: NavItem[] = [
  // ...existing items unchanged...
  {
    href: '/cuts',
    label: 'Broadcast Cuts',
    icon: HiOutlineScissors,
    showFor: (role) => role === 'ADMIN',   // matches scanner gating; shared Grabien seat = admin-only for v1
    badge: { label: 'BETA', variant: 'beta' },
  },
];
```

Rationale: `BETA` in amber (dotted border, see below) reads "experimental" and is visually distinct from the crimson count pill the mature For Review item uses — two different meanings, two different treatments. Icon `HiOutlineScissors` is in `react-icons/hi2` (same set every other nav icon imports from).

### 3.2 `src/components/layout/Sidebar.tsx` — render the badge

Inside the existing `navItems.map` link body (after the label, same `ml-auto` slot the review-count pill uses at `Sidebar.tsx:278`):

```tsx
{item.badge && (
  <span
    className={`ml-auto text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded flex-shrink-0 border border-dashed ${
      item.badge.variant === 'beta'
        ? 'text-amber-300 bg-amber-500/15 border-amber-400/50'
        : 'text-press-400 bg-press-500/15 border-press-400/50'
    }`}
  >
    {item.badge.label}
  </span>
)}
```

(The dashed border is the "still wet paint" cue; the solid crimson pill remains reserved for live counts. If an item ever had both a badge and a count, the count wins the `ml-auto` slot — not a case that exists yet.)

Also add to Sidebar (same mechanic as `reviewCount`, `Sidebar.tsx:224-238`): poll `/api/cuts/pulls?active=1` every 60s for the ADMIN role and, when `activePulls > 0`, swap the BETA badge for a crimson count pill with `motion-safe:animate-pulse` — live activity beats a static label.

### 3.3 `src/components/layout/BottomNav.tsx` — mobile entry (structural note)

**Honest divergence, decided deliberately:** BottomNav is not driven by `navigation.ts` — it's a 3-tab in-page controller for the dashboard (`activeTab` state + `?tab=`, `dashboard/page.tsx:54`). Broadcast Cuts is a separate route, so the Cuts tab is a **route tab**: tapping it navigates to `/cuts` instead of switching dashboard panes, and the `/cuts` page renders the same `<BottomNav activeTab="cuts" />` so the bar stays visually persistent. This is the smallest change that gives mobile a real, always-visible entry; unifying BottomNav onto `navigation.ts` wholesale is a bigger refactor deliberately not smuggled into this feature (flagged as optional follow-up).

```tsx
'use client';

import { useRouter } from 'next/navigation';
import {
  HiOutlineHome,
  HiOutlineFire,
  HiOutlineChartBarSquare,
  HiOutlineScissors,
} from 'react-icons/hi2';

export type BottomNavTabId = 'home' | 'hot' | 'analytics' | 'cuts';

interface BottomNavProps {
  activeTab: BottomNavTabId | (string & {});
  onTabChange: (tab: BottomNavTabId) => void;
  /** Number of in-flight cut pulls; >0 renders a pulsing dot on the Cuts tab */
  activePulls?: number;
}

type TabId = BottomNavTabId;

const tabs: { id: TabId; label: string; icon: typeof HiOutlineHome; href?: string; isBeta?: boolean }[] = [
  { id: 'home', label: 'Home', icon: HiOutlineHome },
  { id: 'hot', label: 'Hot', icon: HiOutlineFire },
  { id: 'cuts', label: 'Cuts', icon: HiOutlineScissors, href: '/cuts', isBeta: true },
  { id: 'analytics', label: 'Analytics', icon: HiOutlineChartBarSquare },
];

export default function BottomNav({ activeTab, onTabChange, activePulls = 0 }: BottomNavProps) {
  const router = useRouter();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="mx-3 mb-3 rounded-2xl bg-ink-900/98 backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-around p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => (tab.href ? router.push(tab.href) : onTabChange(tab.id))}
                className={`relative flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all active:scale-95 ${
                  isActive ? 'bg-white/15' : ''
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Live-pull dot (rendering in progress) beats the static beta dot */}
                {tab.id === 'cuts' && activePulls > 0 ? (
                  <span className="absolute top-1.5 right-2.5 w-2 h-2 rounded-full bg-press-500 motion-safe:animate-pulse" aria-hidden />
                ) : tab.isBeta ? (
                  <span className="absolute top-1.5 right-2.5 w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden />
                ) : null}
                <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-white/50'}`} />
                <span className={`text-[11px] font-semibold ${isActive ? 'text-white' : 'text-white/40'}`}>
                  {tab.label}
                  {tab.isBeta && activePulls === 0 && (
                    <span className="ml-1 text-[8px] font-bold text-amber-400 align-super">β</span>
                  )}
                </span>
                {tab.id === 'cuts' && (
                  <span className="sr-only">
                    {activePulls > 0 ? `, ${activePulls} pull${activePulls === 1 ? '' : 's'} in progress` : ', beta feature'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// BottomNavLight gets the same tabs array automatically (shared const) — add the
// dot/beta marks there too if the analytics light page ever shows the Cuts tab.
```

Mobile badge decision: a full "BETA" pill doesn't fit a 4-tab bar; the treatment is an amber dot + superscript β on the label (quiet), which upgrades to a pulsing crimson dot when a pull is actually rendering (loud, earned). Existing callers that don't pass `activePulls` are unaffected (defaulted).

---

## 4. Feature components

File locations follow the codebase layout: page at `src/app/cuts/page.tsx`, components in `src/components/cuts/`, shared types in `src/lib/cuts.ts`. All `'use client'`, `ink-*`/`press-*` tokens only, hi2 icons.

### 4.1 `src/lib/cuts.ts` — shared types + stage config (the StatusBadge pattern)

```ts
// Shared types for the Broadcast Cuts feature.
// Mirrors the grabien-api backend's real shapes (see docs/grabien-clipper-feature-design.md §6).

export interface CutSearchFilters {
  person?: string;
  show?: string;
  network?: string;
  date?: string;        // YYYY-MM-DD (ET)
  timeWindow?: string;  // e.g. "20:00-23:00" (ET)
}

export interface CutCandidate {
  id: string;             // backend candidate_id — required to continue past ambiguity
  station: string;        // e.g. "FNC"
  show: string;
  airDate: string;        // ISO — ALWAYS displayed in ET per house rule
  headline: string;
  summary: string;
  thumbnailUrl: string | null;
  durationS: number | null;
}

// Pipeline stages — server-persisted on the CutPull row, polled by the client.
export type PullStage =
  | 'QUEUED'        // waiting for the shared single-seat Grabien line
  | 'SUBMITTING'    // render job being submitted
  | 'RENDERING'     // Grabien-side render (the minutes-long stage)
  | 'DOWNLOADING'   // mp4 transferring to Newsroom storage
  | 'RAW_READY'     // full untrimmed segment on disk + sidecar metadata
  | 'FAILED';

export interface CutPull {
  id: string;
  candidate: CutCandidate;
  stage: PullStage;
  queuePosition: number | null;       // when QUEUED behind the busy line
  intendedStartMs: number;            // trim intent — recorded, NOT applied by Grabien
  intendedEndMs: number;
  rawDurationS: number | null;        // actual full-segment length once downloaded
  rawUntrimmed: true;                 // literal: every Grabien pull is raw (backend-confirmed)
  mp4Path: string | null;             // set at RAW_READY (server-side path; download via API)
  error: { stage: PullStage; message: string } | null;  // verbatim backend cause — never swallowed
  createdAt: string;
  updatedAt: string;
}

// Same shape philosophy as STATUS_CONFIG in src/components/ui/StatusBadge.tsx.
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

export const PIPELINE_STAGES: PullStage[] = [
  'QUEUED', 'SUBMITTING', 'RENDERING', 'DOWNLOADING', 'RAW_READY',
];

export function formatEt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }) + ' ET';
}

export function formatElapsed(fromIso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
```

### 4.2 `src/components/cuts/CutSearch.tsx` — conversational search

One natural-language input; the server parses it into structured filters (person/show/network/date) and echoes them back as removable chips, so the user *sees* what the machine understood and can correct it — that's the disambiguation-before-disambiguation. Mobile: filters editable in a bottom sheet.

```tsx
'use client';

import { useState, FormEvent } from 'react';
import { HiOutlineMagnifyingGlass, HiXMark, HiOutlineAdjustmentsHorizontal } from 'react-icons/hi2';
import type { CutSearchFilters } from '@/lib/cuts';

const EXAMPLE_QUERIES = [
  'Hannity opening monologue last night',
  'Gutfeld on Fox News yesterday 10pm',
  'CNN panel on the border, July 2',
];

interface CutSearchProps {
  onSearch: (query: string, filters: CutSearchFilters) => void;
  isSearching: boolean;
  /** Filters the server parsed from the last query — echoed as chips */
  parsedFilters: CutSearchFilters;
  onRemoveFilter: (key: keyof CutSearchFilters) => void;
}

const FILTER_LABELS: Record<keyof CutSearchFilters, string> = {
  person: 'Person',
  show: 'Show',
  network: 'Network',
  date: 'Date',
  timeWindow: 'Time',
};

export default function CutSearch({ onSearch, isSearching, parsedFilters, onRemoveFilter }: CutSearchProps) {
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isSearching) onSearch(query.trim(), parsedFilters);
  };

  const activeFilters = (Object.entries(parsedFilters) as [keyof CutSearchFilters, string][])
    .filter(([, v]) => Boolean(v));

  return (
    <div>
      <form onSubmit={submit} role="search" aria-label="Search broadcast segments">
        <div className="relative">
          <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe the cut — person, show, network, when…"
            disabled={isSearching}
            className="w-full pl-12 pr-28 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white
              placeholder:text-ink-400 text-[15px]
              focus:outline-none focus:ring-2 focus:ring-press-500/50 focus:border-press-500/50
              disabled:opacity-60 transition-colors"
            aria-label="Describe the broadcast segment you want"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {/* Mobile: filter sheet trigger */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="sm:hidden p-2 rounded-lg text-ink-300 hover:text-white hover:bg-white/10 transition-colors
                focus:outline-none focus:ring-2 focus:ring-press-500/50"
              aria-label="Edit search filters"
            >
              <HiOutlineAdjustmentsHorizontal className="w-5 h-5" />
            </button>
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="px-4 py-2 rounded-lg bg-press-500 hover:bg-press-600 text-white text-sm font-semibold
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                focus:outline-none focus:ring-2 focus:ring-press-500/50 focus:ring-offset-2 focus:ring-offset-ink-900"
            >
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {/* Parsed-filter chips: what the machine understood, correctable */}
      {activeFilters.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Active search filters">
          <span className="text-xs text-ink-400">Searching for:</span>
          {activeFilters.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full
                bg-ink-700/60 border border-white/10 text-xs text-ink-100"
            >
              <span className="text-ink-400">{FILTER_LABELS[key]}:</span>
              <span className="font-medium">{value}</span>
              <button
                onClick={() => onRemoveFilter(key)}
                className="p-0.5 rounded-full hover:bg-white/10 text-ink-400 hover:text-white transition-colors
                  focus:outline-none focus:ring-2 focus:ring-press-500/50"
                aria-label={`Remove ${FILTER_LABELS[key]} filter`}
              >
                <HiXMark className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Empty-state teaching: example queries as one-tap chips */}
      {!isSearching && activeFilters.length === 0 && (
        <div className="mt-4">
          <p className="text-xs text-ink-400 mb-2">Try something like:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); onSearch(ex, {}); }}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-ink-200
                  hover:bg-white/10 hover:text-white transition-colors
                  focus:outline-none focus:ring-2 focus:ring-press-500/50"
              >
                “{ex}”
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile filter sheet — structured edit of the parsed filters.
          Prototype note: v1 can reuse the shadcn Sheet already in src/components/ui/sheet
          (per CLAUDE.md component list) with side="bottom". Omitted here for brevity. */}
      {sheetOpen && (
        <div className="sm:hidden" /* shadcn <Sheet side="bottom"> with per-filter inputs */ />
      )}
    </div>
  );
}
```

### 4.3 `src/components/cuts/CandidatePicker.tsx` — disambiguation

Radio-group semantics (keyboard: arrows move selection, Enter confirms). Explicit confirm button — even a single candidate needs the click.

```tsx
'use client';

import Image from 'next/image';
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

export default function CandidatePicker({
  candidates, selectedId, onSelect, onConfirm, isSubmitting,
}: CandidatePickerProps) {
  if (candidates.length === 0) return null;

  return (
    <section aria-labelledby="candidates-heading" className="mt-8">
      <div className="flex items-baseline justify-between mb-4">
        <h2 id="candidates-heading" className="text-sm font-semibold text-white">
          {candidates.length === 1
            ? '1 segment found — confirm it’s the right one'
            : `${candidates.length} segments match — pick the right one`}
        </h2>
        <span className="text-xs text-ink-400">Air times shown in ET</span>
      </div>

      <div
        role="radiogroup"
        aria-label="Matching broadcast segments"
        className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      >
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
                ${isSelected
                  ? 'border-press-500 bg-press-500/10 shadow-card-hover'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'}`}
            >
              {/* Thumbnail — 16:9, station chip overlaid */}
              <div className="relative aspect-video bg-ink-800">
                {c.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Grabien CDN host not in next.config images
                  <img
                    src={c.thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
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
                <p className={`text-sm leading-snug line-clamp-2 transition-colors ${
                  isSelected ? 'text-white' : 'text-ink-100 group-hover:text-white'
                }`}>
                  {c.headline}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Confirm bar — sticky above BottomNav on mobile, inline on desktop */}
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
```

Note the pre-commitment copy: the raw-untrimmed truth is stated **before** the user pulls, not discovered after.

### 4.4 `src/components/cuts/PullStatusCard.tsx` — the Pull Rail (signature element)

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  HiOutlineArrowDownTray, HiOutlineScissors, HiOutlineArrowPath,
  HiOutlineExclamationTriangle, HiOutlineChevronDown,
} from 'react-icons/hi2';
import type { CutPull, PullStage } from '@/lib/cuts';
import { PULL_STAGE_CONFIG, PIPELINE_STAGES, formatEt, formatElapsed } from '@/lib/cuts';

interface PullStatusCardProps {
  pull: CutPull;
  onRetry: (pullId: string) => void;
  onSendToTrim: (pullId: string) => void;   // v1: records intent; real trimmer pending (§6)
  onDownloadRaw: (pullId: string) => void;
}

/** Live mm:ss counter — the studio-clock tick that makes a long wait legible. */
function ElapsedTimecode({ since, running }: { since: string; running: boolean }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return (
    <span
      className={`font-mono text-lg tabular-nums tracking-tight ${running ? 'text-white' : 'text-ink-400'}`}
      aria-hidden
    >
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
                  done ? 'bg-emerald-400'
                  : current ? `${cfg.dotClass} motion-safe:animate-pulse`
                  : 'bg-white/15'
                }`}
                aria-hidden
              />
              <span className={`text-[10px] font-medium truncate max-w-[72px] ${
                current ? cfg.textClass : done ? 'text-ink-300' : 'text-ink-500'
              }`}>
                {cfg.label}
              </span>
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <span
                className={`h-px flex-1 mx-1 mb-4 transition-colors duration-200 ${
                  done ? 'bg-emerald-400/50' : 'bg-white/10'
                }`}
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
    <article
      className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
      aria-label={`Pull: ${c.headline}, status ${cfg.label}`}
    >
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
          {cfg.label}{pull.stage === 'QUEUED' && pull.queuePosition ? `, position ${pull.queuePosition} in queue` : ''}
        </span>
      </div>

      {/* ---- FAILED ---- */}
      {pull.stage === 'FAILED' && pull.error && (
        <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/30 p-3">
          <div className="flex items-start gap-2">
            <HiOutlineExclamationTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-300">
                Failed while {PULL_STAGE_CONFIG[pull.error.stage].label.toLowerCase()}
              </p>
              {/* Verbatim backend cause — never a swallowed generic */}
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
          <p className="mt-2 text-xs text-ink-400">
            {pull.stage === 'QUEUED' && pull.queuePosition
              ? `Grabien line is busy — queued behind ${pull.queuePosition} other pull${pull.queuePosition === 1 ? '' : 's'}.`
              : cfg.hint}
          </p>
        </>
      )}

      {/* ---- RAW READY ---- */}
      {pull.stage === 'RAW_READY' && (
        <div className="mt-3">
          {/* The amber band: the raw-untrimmed truth, impossible to miss */}
          <div className="rounded-lg bg-amber-500/15 border border-amber-400/40 px-3 py-2.5 flex items-center gap-2.5">
            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-ink-950 text-[10px] font-black tracking-wide flex-shrink-0">
              RAW
            </span>
            <p className="text-xs text-amber-200 leading-snug">
              Full untrimmed segment
              {pull.rawDurationS != null && (
                <> — <span className="font-mono font-semibold">{Math.floor(pull.rawDurationS / 60)}m {Math.floor(pull.rawDurationS % 60)}s</span></>
              )}
              . Intended cut:{' '}
              <span className="font-mono font-semibold">
                {formatElapsed(new Date(Date.now() - pull.intendedStartMs).toISOString())}–{formatElapsed(new Date(Date.now() - pull.intendedEndMs).toISOString())}
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
```

> Prototype note (known rough edge, fix at implementation): the "Intended cut" display abuses `formatElapsed` to format `intendedStartMs/EndMs`; a real `formatMs(ms)` helper (mm:ss from a millisecond offset) belongs in `src/lib/cuts.ts`.

### 4.5 `src/app/cuts/page.tsx` — page shell (scanner-pattern gate + 10s poll)

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/layout/BottomNav';
import CutSearch from '@/components/cuts/CutSearch';
import CandidatePicker from '@/components/cuts/CandidatePicker';
import PullStatusCard from '@/components/cuts/PullStatusCard';
import { SkeletonCardDark } from '@/components/ui/Skeleton';
import type { CutCandidate, CutPull, CutSearchFilters } from '@/lib/cuts';

export default function CutsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [parsedFilters, setParsedFilters] = useState<CutSearchFilters>({});
  const [candidates, setCandidates] = useState<CutCandidate[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pulls, setPulls] = useState<CutPull[]>([]);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Same gate as scanner (src/app/scanner/page.tsx:425-428)
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated' && session!.user.role !== 'ADMIN') router.push('/dashboard');
  }, [status, session, router]);

  const loadPulls = useCallback(async () => {
    try {
      const res = await fetch('/api/cuts/pulls');
      if (res.ok) {
        const data = await res.json();
        setPulls(data.pulls || []);
        setSessionExpired(Boolean(data.grabienSessionExpired));
      }
    } catch { /* transient poll miss — next tick recovers */ }
  }, []);

  // Poll every 10s while any pull is live; back off to 60s when idle.
  useEffect(() => {
    if (status !== 'authenticated') return;
    loadPulls();
    const anyLive = pulls.some((p) => !['RAW_READY', 'FAILED'].includes(p.stage));
    const interval = setInterval(loadPulls, anyLive ? 10_000 : 60_000);
    return () => clearInterval(interval);
  }, [status, loadPulls, pulls]);

  const handleSearch = async (query: string, filters: CutSearchFilters) => {
    setIsSearching(true);
    setSearchError(null);
    setCandidates(null);
    setSelectedId(null);
    try {
      const res = await fetch('/api/cuts/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, filters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Search failed (${res.status})`);
      setParsedFilters(data.parsedFilters || {});
      setCandidates(data.candidates || []);
      if (data.candidates?.length === 1) setSelectedId(data.candidates[0].id); // pre-select, still confirmed
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/cuts/pulls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Pull failed to start (${res.status})`);
      setCandidates(null);
      setSelectedId(null);
      await loadPulls();
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Pull failed to start');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <SkeletonCardDark />
      </div>
    );
  }

  const activePulls = pulls.filter((p) => !['RAW_READY', 'FAILED'].includes(p.stage)).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-950 to-ink-900 pb-28 md:pb-8">
      <main className="max-w-5xl mx-auto px-4 pt-6 md:pt-10 md:pl-72">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-display-md text-white">Broadcast Cuts</h1>
            <span className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded border border-dashed border-amber-400/50 bg-amber-500/15 text-amber-300">
              BETA
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-300">
            Pull a raw broadcast segment from Grabien, then trim it in Newsroom.
          </p>
        </header>

        {/* Shared-session banner (admin action, page-level) */}
        {sessionExpired && (
          <div className="mb-5 rounded-lg bg-amber-500/15 border border-amber-400/40 px-4 py-3 text-sm text-amber-200" role="alert">
            Grabien session expired — re-harvest the cookie from a logged-in browser, then retry your pulls.
          </div>
        )}

        <CutSearch
          onSearch={handleSearch}
          isSearching={isSearching}
          parsedFilters={parsedFilters}
          onRemoveFilter={(key) => setParsedFilters((f) => ({ ...f, [key]: undefined }))}
        />

        {searchError && (
          <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300" role="alert">
            {searchError}
          </div>
        )}

        {isSearching && (
          <div className="mt-8 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {[1, 2, 3].map((i) => <SkeletonCardDark key={i} />)}
          </div>
        )}

        {candidates !== null && candidates.length === 0 && !isSearching && (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-sm text-white font-medium">No segments matched</p>
            <p className="mt-1 text-xs text-ink-400">
              Try removing a filter above — date and time-window are the narrowest.
            </p>
          </div>
        )}

        {candidates !== null && candidates.length > 0 && (
          <CandidatePicker
            candidates={candidates}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onConfirm={handleConfirm}
            isSubmitting={isSubmitting}
          />
        )}

        {pulls.length > 0 && (
          <section aria-labelledby="pulls-heading" className="mt-10">
            <h2 id="pulls-heading" className="text-sm font-semibold text-white mb-3">
              Pulls
            </h2>
            <div className="space-y-3">
              {pulls.map((pull) => (
                <PullStatusCard
                  key={pull.id}
                  pull={pull}
                  onRetry={async (id) => { await fetch(`/api/cuts/pulls/${id}/retry`, { method: 'POST' }); loadPulls(); }}
                  onSendToTrim={(id) => {
                    // v1: records trim intent server-side; real trimmer pending (§6).
                    fetch(`/api/cuts/pulls/${id}/trim-intent`, { method: 'POST' });
                  }}
                  onDownloadRaw={(id) => { window.location.href = `/api/cuts/pulls/${id}/file`; }}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <BottomNav activeTab="cuts" onTabChange={(tab) => router.push(`/dashboard?tab=${tab}`)} activePulls={activePulls} />
    </div>
  );
}
```

(Implementation note: the poll `useEffect` above re-arms when `pulls` changes — fine for a prototype; at implementation, derive `anyLive` into its own state to avoid interval churn on every poll response. Desktop layout assumes the Sidebar is present per the app shell; `md:pl-72` matches the `w-64` sidebar + gutter.)

---

## 5. API-route contract (Newsroom side — thin, ADMIN-gated, all copy the scanner auth pattern)

| Route | Method | Purpose | Notes |
|---|---|---|---|
| `/api/cuts/search` | POST `{ query, filters }` | NL parse + Grabien search | Parses the conversational query into `parsedFilters` (existing Anthropic client per CLAUDE.md, prefill-`{` JSON pattern) then calls the wrapper service's `/search`. Returns `{ parsedFilters, candidates }`. Real search latency is ~16s (backend-measured) — set `maxDuration = 60` like Getty. Upstream errors pass through verbatim as 502. |
| `/api/cuts/pulls` | POST `{ candidateId }` | Create pull, enqueue render | Creates a `CutPull` row (`QUEUED`), server enforces **one concurrent Grabien render** (shared single seat). Returns the pull. |
| `/api/cuts/pulls` | GET | List pulls (newest first) + `grabienSessionExpired` flag | The 10s poll target. |
| `/api/cuts/pulls/[id]` | GET | Single pull status | For a future detail view / deep link. |
| `/api/cuts/pulls/[id]/retry` | POST | Re-run from the failed stage | Uses `expected_summary` override to dodge the backend's known rerun substring-match gap. |
| `/api/cuts/pulls/[id]/file` | GET | Stream/redirect the `-RAW` mp4 | Sets `Content-Disposition` with the `-RAW`-suffixed filename so the raw marker survives into the user's downloads folder. |
| `/api/cuts/pulls/[id]/trim-intent` | POST | Record "sent to trim" + intended bounds | v1 stub for the missing trimmer (§6). |

New Prisma model (migration required, per the schema hard-constraints in CLAUDE.md — committed migration or it crashes prod):

```prisma
model CutPull {
  id               String   @id @default(cuid())
  stage            String   // QUEUED | SUBMITTING | RENDERING | DOWNLOADING | RAW_READY | FAILED
  candidateJson    Json     // CutCandidate snapshot (station/show/airDate/headline/summary/thumb)
  intendedStartMs  Int
  intendedEndMs    Int
  rawDurationS     Int?
  mp4Path          String?
  metadataPath     String?
  errorStage       String?
  errorMessage     String?  // verbatim backend cause — never collapsed to a generic
  createdById      String
  createdBy        User     @relation(fields: [createdById], references: [id])
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

---

## 6. Backend work this design ASSUMES but which DOES NOT EXIST yet

The grabien-api repo is a **Python library + CLI** (`scripts/run_clip_request.py`), not an HTTP service. Everything below is required before this UI touches real data — in rough build order:

1. **HTTP wrapper service around `grabien-api`** (the big one). A small FastAPI (or similar) service — natural home is Goat, alongside the harvested-cookie source — exposing:
   - `POST /search` → candidates (person/show/network/date/time-window filters; ~16s real latency — the wrapper's own timeouts must exceed that, per the backend's fixed pre-flight-timeout lesson).
   - `POST /clips` → submit render for a candidate (uses `fetch_clip_defaults()` + full payload, as the library already does).
   - `GET /clips/{id}` → render status; `GET /clips/{id}/file` → the downloaded mp4 + sidecar.
   - **Job persistence + a worker loop**: `run_clip_request.py` is synchronous end-to-end; the multi-minute poll (`poll_for_clip`, default `timeout_s=120` is known-too-short — raise it) must move into a background worker with the job state the UI polls. Per house constraint, the poll loop needs a **hard total wall-clock deadline**, not just per-request timeouts.
   - Auth between Newsroom (Hetzner) and the wrapper (Goat): shared secret header at minimum; network path (tunnel/Tailscale) TBD by the orchestrating session.
2. **Cookie/session management**: the wrapper holds the harvested Grabien cookie; needs an endpoint or health flag Newsroom can read (`grabienSessionExpired`) and a documented re-harvest procedure (browser-harness). `check_session_valid()` currently swallows failure detail into a bare boolean — the wrapper should surface the real cause.
3. **Single-seat concurrency guard**: one render at a time, FIFO queue with queue positions (feeds the UI's "queued behind N" state). Lives in the wrapper, not Newsroom.
4. **Rerun-collision fix**: the backend's `poll_for_clip` substring-match gap (a rerun matches the first run's file). The wrapper must pass a distinct `expected_summary` per job (the library already accepts the override).
5. **Machine-enforceable raw flag**: the `-RAW` filename suffix + `raw_untrimmed: true` sidecar field are **documentation-only today** (per the skill doc — "not yet built"). The wrapper should write both; the UI's amber band assumes the sidecar field exists.
6. **NL query parsing**: `/api/cuts/search`'s conversational-to-filters step (Newsroom-side, existing Anthropic client — new prompt + JSON schema, ambiguity resolved by echoing `parsedFilters` chips, never by guessing silently).
7. **File transport**: the wrapper downloads to Goat-local disk; Newsroom (Hetzner) needs the bytes — either the wrapper serves the file and Newsroom's `/file` route proxies/streams it, or a push to Newsroom-reachable storage. Decision for the orchestrating session.
8. **The trim step itself**: **Newsroom has no clip/trim editor** (§1, confirmed by search). The transcript-based trim pipeline lives outside this repo. "Send to trim" is a v1 intent-recording stub. Options, in ascending effort: (a) webhook that hands the mp4 + intended bounds to the external pipeline; (b) a server-side ffmpeg trim using the sidecar bounds with a confirm preview; (c) a real in-app scrubber/trimmer. The UI is shaped so any of the three slots behind the existing button.
9. **Prisma migration** for `CutPull` (§5), following the repo's canonical migrate-dev → commit → deploy flow.

### Housekeeping flags for the orchestrating session
- impeccable's setup script reports `NO_PRODUCT_MD` for this repo; creating `PRODUCT.md` was out of scope for this pass (task forbade repo modifications). Worth doing separately if impeccable will be used on Newsroom again.
- `BottomNavLight` (analytics light theme) shares the `tabs` array and will show the Cuts tab automatically; verify the light-theme styling of the beta dot at implementation.
- Grabien thumbnails come from a Grabien CDN host — either add it to `next.config` `images.remotePatterns` and use `next/image`, or keep the plain `<img loading="lazy">` used in the prototype.
