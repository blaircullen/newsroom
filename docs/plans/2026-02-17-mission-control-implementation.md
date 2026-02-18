# Mission Control Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Newsroom UI from sidebar-based editorial CMS to a "Mission Control" command center aesthetic with horizontal nav, data-dense dashboard, distraction-free editor, and side-panel publish flow.

**Architecture:** Phased approach — feature flag first, then design tokens, then shell/navigation, then each page in usage-priority order. Each phase is independently deployable. Existing API routes and data layer are untouched; this is purely a frontend/component redesign. **The new UI lives alongside the old** — only admins who opt in via a "Newsroom 2.0: Revenge of the Sidebar" toggle can see it.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS (custom tokens), TipTap, React Context, Framer Motion (new — for animations)

**Design Doc:** `docs/plans/2026-02-17-mission-control-redesign.md`

---

## Phase 0: Feature Flag — "Newsroom 2.0: Revenge of the Sidebar"

The entire redesign is gated behind a per-user feature flag. Only ADMINs see the toggle. When enabled, all Mission Control components render; when disabled, the original UI renders unchanged.

### Task 0A: Add UI version preference to user model

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Read the User model in schema.prisma**

Find the `User` model and understand existing fields.

**Step 2: Add `uiVersion` field**

Add to the `User` model:

```prisma
uiVersion  String  @default("classic") @map("ui_version")
```

Valid values: `"classic"` (default, current UI) or `"mission-control"` (new UI).

**Step 3: Run migration locally**

Run: `npx prisma db push` (local dev)

**Step 4: Generate Prisma client**

Run: `npx prisma generate`

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add uiVersion field to User model for Mission Control flag"
```

> **CRITICAL:** Do NOT push to main yet. Run migration SQL on production BEFORE pushing:
> ```bash
> ssh root@178.156.143.87
> docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c "ALTER TABLE users ADD COLUMN ui_version TEXT NOT NULL DEFAULT 'classic';"
> ```

---

### Task 0B: Create UI version toggle API route

**Files:**
- Create: `src/app/api/user/ui-version/route.ts`

**Step 1: Build the toggle endpoint**

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET: return current user's uiVersion
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { uiVersion: true },
  });

  return NextResponse.json({ uiVersion: user?.uiVersion || 'classic' });
}

// PUT: update uiVersion (admin only)
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { uiVersion } = await req.json();
  if (!['classic', 'mission-control'].includes(uiVersion)) {
    return NextResponse.json({ error: 'Invalid version' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { uiVersion },
  });

  return NextResponse.json({ uiVersion });
}
```

**Step 2: Commit**

```bash
git add src/app/api/user/ui-version/route.ts
git commit -m "feat: add API route for UI version toggle"
```

---

### Task 0C: Create UIVersionContext and toggle component

**Files:**
- Create: `src/contexts/UIVersionContext.tsx`
- Create: `src/components/ui/UIVersionToggle.tsx`

**Step 1: Build the context**

```typescript
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

type UIVersion = 'classic' | 'mission-control';

interface UIVersionContextType {
  uiVersion: UIVersion;
  setUIVersion: (v: UIVersion) => void;
  isAdmin: boolean;
  loading: boolean;
}

const UIVersionContext = createContext<UIVersionContextType>({
  uiVersion: 'classic',
  setUIVersion: () => {},
  isAdmin: false,
  loading: true,
});

export function UIVersionProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [uiVersion, setUIVersionState] = useState<UIVersion>('classic');
  const [loading, setLoading] = useState(true);
  const isAdmin = session?.user?.role === 'ADMIN';

  useEffect(() => {
    fetch('/api/user/ui-version')
      .then(r => r.json())
      .then(d => { setUIVersionState(d.uiVersion || 'classic'); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const setUIVersion = async (v: UIVersion) => {
    setUIVersionState(v);
    await fetch('/api/user/ui-version', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uiVersion: v }),
    });
  };

  return (
    <UIVersionContext.Provider value={{ uiVersion, setUIVersion, isAdmin, loading }}>
      {children}
    </UIVersionContext.Provider>
  );
}

export const useUIVersion = () => useContext(UIVersionContext);
```

**Step 2: Build the toggle component**

```typescript
'use client';

import { useUIVersion } from '@/contexts/UIVersionContext';
import { HiOutlineRocketLaunch, HiOutlineBuildingLibrary } from 'react-icons/hi2';

export default function UIVersionToggle() {
  const { uiVersion, setUIVersion, isAdmin } = useUIVersion();

  if (!isAdmin) return null;

  return (
    <button
      onClick={() => setUIVersion(uiVersion === 'classic' ? 'mission-control' : 'classic')}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-fast"
      title={uiVersion === 'classic'
        ? 'Switch to Newsroom 2.0: Revenge of the Sidebar'
        : 'Switch back to Classic (if you must)'}
    >
      {uiVersion === 'classic' ? (
        <>
          <HiOutlineRocketLaunch className="w-4 h-4 text-press-500" />
          <span>Try 2.0</span>
        </>
      ) : (
        <>
          <HiOutlineBuildingLibrary className="w-4 h-4 text-paper-400" />
          <span>Back to Classic</span>
        </>
      )}
    </button>
  );
}
```

**Step 3: Commit**

```bash
git add src/contexts/UIVersionContext.tsx src/components/ui/UIVersionToggle.tsx
git commit -m "feat: add UIVersionContext and admin toggle for 'Newsroom 2.0: Revenge of the Sidebar'"
```

---

### Task 0D: Wire UIVersionProvider into AppShell

**Files:**
- Modify: `src/components/layout/AppShell.tsx`

**Step 1: Read AppShell**

Read `src/components/layout/AppShell.tsx` to find where to add the provider and toggle.

**Step 2: Wrap content in UIVersionProvider**

Add `<UIVersionProvider>` around the main content of AppShell. Add `<UIVersionToggle />` into the current sidebar user section (or wherever the theme toggle lives) — this is the classic UI, so it goes where admins will see it.

**Step 3: Add conditional rendering scaffold**

In AppShell, use `useUIVersion()` to conditionally render:
- `uiVersion === 'classic'` → current Sidebar + layout (unchanged)
- `uiVersion === 'mission-control'` → TopBar + WireTicker + new layout (built in later phases)

For now, the mission-control branch can render a placeholder: `<div className="p-8 text-paper-400">Mission Control coming soon...</div>`

**Step 4: Verify toggle works**

Run: `npm run dev`
Test: Log in as admin, see "Try 2.0" toggle, click it, see placeholder, click "Back to Classic", see original UI.

**Step 5: Commit**

```bash
git add src/components/layout/AppShell.tsx
git commit -m "feat: wire UIVersionProvider into AppShell with conditional rendering"
```

---

### Task 0E: Conditional page rendering pattern

**Files:**
- No new files — establish the pattern

**The pattern for all subsequent phases:**

Every page that gets a redesign will use this pattern:

```typescript
'use client';

import { useUIVersion } from '@/contexts/UIVersionContext';

// Original page component (rename from default export)
function ClassicDashboard() {
  // ... existing dashboard code unchanged ...
}

// New Mission Control version
function MissionControlDashboard() {
  // ... new layout ...
}

export default function DashboardPage() {
  const { uiVersion } = useUIVersion();
  return uiVersion === 'mission-control' ? <MissionControlDashboard /> : <ClassicDashboard />;
}
```

This means:
- **Zero risk to existing users** — classic UI is completely untouched
- **Admins can A/B test** — toggle between versions to compare
- **Incremental rollout** — once all admins are happy, flip the default, then remove classic code

No commit for this task — it's a documentation/pattern note.

---

## Phase 1: Design System Foundation

### Task 1: Add new design tokens to Tailwind config

**Files:**
- Modify: `tailwind.config.ts` (71 lines)

**Step 1: Read the current config**

Read `tailwind.config.ts` to understand existing color/font/shadow structure.

**Step 2: Add signal colors, glow tokens, animation tokens**

Add to the `extend` section of `tailwind.config.ts`:

```typescript
// Inside theme.extend.colors:
signal: {
  live: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
},

// Inside theme.extend.boxShadow:
'glow-crimson': '0 0 20px rgba(212,43,43,0.3)',
'glow-live': '0 0 12px rgba(239,68,68,0.4)',
'glow-success': '0 0 12px rgba(34,197,94,0.3)',
'glow-warning': '0 0 12px rgba(245,158,11,0.3)',

// Inside theme.extend.transitionDuration:
'fast': '150ms',
'base': '300ms',
'slow': '500ms',

// Inside theme.extend.transitionTimingFunction:
'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',

// Inside theme.extend.animation:
'pulse-live': 'pulse-live 1.5s ease-in-out infinite',
'count-up': 'count-up 400ms ease-out',
'shimmer': 'shimmer 1.5s ease-in-out infinite',
'slide-in-right': 'slide-in-right 300ms ease-out',
'slide-in-up': 'slide-in-up 300ms ease-out',

// Inside theme.extend.keyframes:
'pulse-live': {
  '0%, 100%': { opacity: '1' },
  '50%': { opacity: '0.5' },
},
'count-up': {
  '0%': { opacity: '0', transform: 'translateY(8px)' },
  '100%': { opacity: '1', transform: 'translateY(0)' },
},
'shimmer': {
  '0%': { backgroundPosition: '-200% 0' },
  '100%': { backgroundPosition: '200% 0' },
},
'slide-in-right': {
  '0%': { transform: 'translateX(100%)', opacity: '0' },
  '100%': { transform: 'translateX(0)', opacity: '1' },
},
'slide-in-up': {
  '0%': { transform: 'translateY(100%)', opacity: '0' },
  '100%': { transform: 'translateY(0)', opacity: '1' },
},
```

**Step 3: Add global CSS utilities**

Add to `src/app/globals.css`:

```css
/* Terminal section headers */
.terminal-label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* Skeleton shimmer for loading states */
.skeleton {
  background: linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-shine) 50%, var(--skeleton-base) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

:root {
  --skeleton-base: theme('colors.paper.200');
  --skeleton-shine: theme('colors.paper.100');
}

.dark {
  --skeleton-base: theme('colors.ink.800');
  --skeleton-shine: theme('colors.ink.700');
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .animate-pulse-live,
  .animate-count-up,
  .animate-shimmer,
  .animate-slide-in-right,
  .animate-slide-in-up {
    animation: none !important;
  }
}
```

**Step 4: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors.

**Step 5: Commit**

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "feat: add Mission Control design tokens — signals, glows, animations"
```

---

### Task 2: Install Framer Motion

**Step 1: Install dependency**

Run: `npm install framer-motion`

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add framer-motion for Mission Control animations"
```

---

## Phase 2: Navigation Shell

### Task 3: Create TopBar component

**Files:**
- Create: `src/components/layout/TopBar.tsx`

**Step 1: Build the TopBar**

```typescript
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { HiOutlineBell, HiOutlineCommandLine } from 'react-icons/hi2';

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Editor', href: '/editor/new' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Social', href: '/social-queue' },
  { label: 'Calendar', href: '/calendar' },
];

export default function TopBar({ onCommandPalette }: { onCommandPalette: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-ink-950 border-b border-ink-800">
      <div className="flex items-center justify-between h-full px-4 max-w-[1600px] mx-auto">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-press-500 shadow-glow-crimson" />
          <span className="font-display font-bold text-paper-100 text-lg tracking-tight">NR</span>
        </Link>

        {/* Nav Links — desktop only */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-fast ${
                isActive(item.href)
                  ? 'text-paper-100 shadow-[0_2px_8px_rgba(212,43,43,0.4)] border-b-2 border-press-500'
                  : 'text-paper-400 hover:text-paper-200 hover:bg-ink-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-3">
          <button
            onClick={onCommandPalette}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-paper-400 bg-ink-900 rounded-md border border-ink-700 hover:border-ink-600 transition-fast"
          >
            <HiOutlineCommandLine className="w-3.5 h-3.5" />
            <span className="font-mono">⌘K</span>
          </button>

          <button className="relative p-2 text-paper-400 hover:text-paper-200 transition-fast">
            <HiOutlineBell className="w-5 h-5" />
            {/* Notification badge — wire up later */}
          </button>

          <div className="w-8 h-8 rounded-full bg-ink-800 border border-ink-700 flex items-center justify-center text-xs font-medium text-paper-300">
            {session?.user?.name?.[0]?.toUpperCase() || '?'}
          </div>
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/layout/TopBar.tsx
git commit -m "feat: add TopBar component for Mission Control nav"
```

---

### Task 4: Create WireTicker component

**Files:**
- Create: `src/components/layout/WireTicker.tsx`

**Step 1: Build the WireTicker**

This component fetches recent activity (publishes, submissions) and scrolls them horizontally. Uses the existing `/api/articles` endpoint to get recent activity.

```typescript
'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns'; // already in project deps
import Link from 'next/link';
import { HiChevronUp, HiChevronDown } from 'react-icons/hi2';

interface WireEvent {
  id: string;
  title: string;
  author: string;
  action: string;
  timestamp: Date;
  href: string;
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
        const res = await fetch('/api/articles?limit=10&sort=updatedAt');
        if (!res.ok) return;
        const data = await res.json();
        const mapped: WireEvent[] = (data.articles || []).map((a: any) => ({
          id: a.id,
          title: a.title || 'Untitled',
          author: a.author?.name || 'Unknown',
          action: a.status === 'PUBLISHED' ? 'published' : a.status === 'SUBMITTED' ? 'submitted' : 'updated',
          timestamp: new Date(a.updatedAt),
          href: `/editor/${a.id}`,
        }));
        setEvents(mapped);
      } catch {}
    }
    fetchEvents();
    const interval = setInterval(fetchEvents, 60_000); // refresh every minute
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
        <button onClick={toggleCollapsed} className="text-paper-500 hover:text-paper-300 transition-fast">
          <HiChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="hidden md:flex fixed top-14 left-0 right-0 z-30 h-8 bg-ink-900 border-b border-ink-800 items-center overflow-hidden">
      <span className="shrink-0 px-3 text-xs font-mono font-medium text-press-500 uppercase tracking-wider">Wire</span>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-6 animate-marquee whitespace-nowrap">
          {events.map((e) => (
            <Link
              key={e.id}
              href={e.href}
              className="inline-flex items-center gap-2 text-xs text-paper-300 hover:text-paper-100 transition-fast"
            >
              <span className="font-medium text-paper-100">{e.author}</span>
              <span className="text-paper-500">{e.action}</span>
              <span className="truncate max-w-[200px]">&ldquo;{e.title}&rdquo;</span>
              <span className="text-paper-500">·</span>
              <span className="text-paper-500">{formatDistanceToNow(e.timestamp, { addSuffix: true })}</span>
            </Link>
          ))}
        </div>
      </div>
      <button onClick={toggleCollapsed} className="shrink-0 px-2 text-paper-500 hover:text-paper-300 transition-fast">
        <HiChevronUp className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
```

**Step 2: Add marquee animation to globals.css**

```css
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.animate-marquee {
  animation: marquee 30s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .animate-marquee { animation: none; }
}
```

**Step 3: Commit**

```bash
git add src/components/layout/WireTicker.tsx src/app/globals.css
git commit -m "feat: add WireTicker component for live activity feed"
```

---

### Task 5: Rewrite AppShell to use TopBar + WireTicker

**Files:**
- Modify: `src/components/layout/AppShell.tsx` (234 lines)
- Modify: `src/components/layout/BottomNav.tsx` (79 lines)

**Step 1: Read current AppShell and BottomNav**

Read both files to understand the current layout structure, auth checks, and system alert logic.

**Step 2: Rewrite AppShell**

Replace the sidebar-based layout with:
- `<TopBar>` fixed at top (56px)
- `<WireTicker>` below TopBar (32px, desktop only)
- Main content area with `pt-14 md:pt-[88px]` (56 + 32) padding
- `<BottomNav>` on mobile
- `<CommandPalette>` overlay (preserve existing)
- Preserve all auth checks, system alerts, and session logic

Key changes:
- Remove `<Sidebar>` import and rendering
- Remove sidebar width padding (`pl-16 md:pl-64`)
- Add `<TopBar>` and `<WireTicker>` imports
- Pass `onCommandPalette` handler to TopBar
- Content area becomes full-width with `max-w-[1600px] mx-auto px-4 md:px-6`

**Step 3: Restyle BottomNav**

Update to match Mission Control:
- 5 tabs: Dashboard, Editor, Analytics, Social, More
- Active tab: crimson icon + glow + label
- Inactive: `paper-500` icon, no label
- Background: `ink-950` with `border-t border-ink-800`
- Safe area inset padding preserved

**Step 4: Verify build and test all routes manually**

Run: `npm run build`
Then: `npm run dev` and navigate to each page.

**Step 5: Commit**

```bash
git add src/components/layout/AppShell.tsx src/components/layout/BottomNav.tsx
git commit -m "feat: replace sidebar with TopBar + WireTicker shell layout"
```

---

### Task 6: Clean up old Sidebar component

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (330 lines)

**Step 1: Verify Sidebar is no longer imported anywhere**

Search for imports of Sidebar across the codebase. If no imports remain after Task 5, delete the file. If some admin pages or other components still reference it, update those references.

**Step 2: Remove or archive Sidebar.tsx**

Delete the file if unused. Do NOT leave dead code.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused Sidebar component"
```

---

## Phase 3: Dashboard Redesign

### Task 7: Create PulseBar component

**Files:**
- Create: `src/components/dashboard/PulseBar.tsx`

**Step 1: Read current StatsGrid.tsx**

Read `src/components/dashboard/StatsGrid.tsx` (179 lines) to understand current stat data structure and API calls.

**Step 2: Build PulseBar**

A full-width horizontal stats strip with 5 metrics. Uses the same data sources as StatsGrid but in a new layout:
- Views today (with mini SVG sparkline)
- Delta from yesterday (percentage, green/red)
- Published this week
- Average read time
- Drafts in queue (crimson glow dot if >0 for admins)

Key implementation:
- All numbers in `font-mono` (JetBrains Mono)
- `ink-900` background with subtle gradient
- Each metric clickable (links to analytics or relevant view)
- Count-up animation on load using `animate-count-up`
- Sparkline: tiny inline SVG, ~60x20px, `press-500` stroke

```typescript
// Data fetching: reuse existing /api/analytics/daily-stats and /api/articles endpoints
// Sparkline: simple SVG polyline from hourly view data
// Animation: staggered opacity+translateY via Framer Motion
```

**Step 3: Commit**

```bash
git add src/components/dashboard/PulseBar.tsx
git commit -m "feat: add PulseBar stats component for Mission Control dashboard"
```

---

### Task 8: Create QueueList component

**Files:**
- Create: `src/components/dashboard/QueueList.tsx`

**Step 1: Read current ArticleCard.tsx and dashboard page**

Read `src/components/dashboard/ArticleCard.tsx` (315 lines) and `src/app/dashboard/page.tsx` (1021 lines) to understand article data structure, filtering, and actions.

**Step 2: Build QueueList**

Replaces the article list as a prioritized action queue:
- Section header: `terminal-label` style "QUEUE" with "Needs Action" count + pulsing crimson dot
- Tab toggle: "My Drafts" / "All Pending" (admin sees both, writer sees own only)
- Each item: left status bar (color-coded), title, author, status, time, action buttons
- Right edge: readiness indicator (filled/empty circle)
- Left-border glow: crimson (submitted), amber (in review), ink-700 (draft)
- Cards clickable -> navigate to `/editor/{id}`
- Reuse existing article fetch logic from dashboard page

**Step 3: Commit**

```bash
git add src/components/dashboard/QueueList.tsx
git commit -m "feat: add QueueList component for prioritized article queue"
```

---

### Task 9: Create TrendingPanel component

**Files:**
- Create: `src/components/dashboard/TrendingPanel.tsx`

**Step 1: Read current dashboard trending/hot articles logic**

Check how `dashboard/page.tsx` fetches and displays hot/trending articles.

**Step 2: Build TrendingPanel**

- Top performing articles with horizontal bar charts (crimson gradient)
- Percentage change indicators
- Social reach summary at bottom
- Optimal posting time suggestion (derived from analytics data)
- Each article clickable -> editor

**Step 3: Commit**

```bash
git add src/components/dashboard/TrendingPanel.tsx
git commit -m "feat: add TrendingPanel with performance bars"
```

---

### Task 10: Create StoryIdeasStrip component

**Files:**
- Create: `src/components/dashboard/StoryIdeasStrip.tsx`

**Step 1: Read current story ideas logic in dashboard**

Check how `dashboard/page.tsx` handles story ideas (fetch, display, dismiss, click-to-draft).

**Step 2: Build StoryIdeasStrip**

- Full-width, compact horizontal card layout (flex, overflow-x-auto)
- Each card: headline suggestion, source tag, recency
- Two actions: "Draft It ->" (navigates to `/editor/new` pre-filled) and "Dismiss"
- `terminal-label` style "STORY IDEAS" header

**Step 3: Commit**

```bash
git add src/components/dashboard/StoryIdeasStrip.tsx
git commit -m "feat: add StoryIdeasStrip for horizontal idea cards"
```

---

### Task 11: Rewrite dashboard page to compose new components

**Files:**
- Modify: `src/app/dashboard/page.tsx` (1021 lines)

**Step 1: Read the full dashboard page**

Understand all data fetching, state management, polling, filtering, and event tracking.

**Step 2: Rewrite the page layout**

Replace the current layout with the Mission Control grid:

```
PulseBar (full width)
QueueList (60%) | TrendingPanel (40%)
StoryIdeasStrip (full width)
```

- Preserve all existing data fetching and state logic
- Replace StatsGrid with PulseBar
- Replace article list with QueueList
- Replace hot articles / top performer sections with TrendingPanel
- Replace story ideas section with StoryIdeasStrip
- Preserve pull-to-refresh, pagination, delete modal, and tracking
- Role-based: pass user role to components for density control

**Step 3: Remove old StatsGrid import**

If StatsGrid is only used in dashboard, it can be deleted after this task.

**Step 4: Verify build and test**

Run: `npm run build`
Then: `npm run dev`, test dashboard at various viewports.

**Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: rewrite dashboard with Mission Control layout — PulseBar, Queue, Trending"
```

---

### Task 12: Clean up replaced dashboard components

**Files:**
- Delete or modify: `src/components/dashboard/StatsGrid.tsx`
- Delete or modify: `src/components/dashboard/ArticleCard.tsx` (if fully replaced)

**Step 1: Search for remaining imports of old components**

If StatsGrid and ArticleCard are not used elsewhere, delete them. ArticleCard may be reused inside QueueList — if so, keep it but restyle it.

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: clean up replaced dashboard components"
```

---

## Phase 4: Editor + Publish

### Task 13: Restyle the editor page

**Files:**
- Modify: `src/app/editor/[id]/page.tsx` (423 lines)

**Step 1: Read the full editor page**

Understand layout, TipTap integration, metadata fields, editorial review panel, auto-save, and publish flow.

**Step 2: Implement editor layout changes**

- **Editor Top Bar (48px):** Replace any existing top section with: back link, truncated title + status badge, preview toggle + overflow menu. `ink-950` background.
- **Writing Canvas:** Center content at `max-w-[680px] mx-auto`. Featured image full-width within column. Title in Playfair Display `display-lg`. Body at 18px, line-height 1.75. Pure `ink-950` background.
- **Status Footer (44px, sticky bottom):** Auto-save indicator (left), word count + read time in JetBrains Mono (center), "Save Draft" + "Submit" with crimson glow (right).
- Move metadata fields (tags, etc.) into the publish side panel — they don't need to clutter the writing view.

**Step 3: Add focus mode**

Add keyboard shortcut `Cmd+\` (and double-click handler) that toggles a `focusMode` state — hides top bar and footer when active.

**Step 4: Verify editor functionality**

Run: `npm run dev`
Test: Create article, edit existing, auto-save, submit, all TipTap features still work.

**Step 5: Commit**

```bash
git add src/app/editor/[id]/page.tsx
git commit -m "feat: restyle editor to distraction-free Mission Control canvas"
```

---

### Task 14: Convert PublishModal to PublishPanel (side panel)

**Files:**
- Modify: `src/components/dashboard/PublishModal.tsx` (730 lines)
- Create: `src/components/ui/SidePanel.tsx` (reusable slide-from-right panel)

**Step 1: Create reusable SidePanel component**

```typescript
// Framer Motion AnimatePresence + motion.div
// Slides from right, 360px width on desktop
// Bottom sheet (85vh) on mobile
// Backdrop overlay with click-to-close
// Escape key to close
// Props: open, onClose, title, children
```

**Step 2: Read current PublishModal**

Read `src/components/dashboard/PublishModal.tsx` (730 lines) to understand the multi-step publish flow: site selection, scheduling, publish results, social queue.

**Step 3: Refactor PublishModal into PublishPanel**

- Wrap existing publish flow logic inside `<SidePanel>`
- Replace modal overlay with side panel slide-in
- Editor content shifts left and dims (handled by editor page via CSS)
- Add live preview card at top of panel
- Add social auto-queue checkboxes
- Full-width crimson publish button at bottom
- Rename file to `PublishPanel.tsx`

**Step 4: Update editor page to use PublishPanel**

Replace PublishModal import with PublishPanel. When open, add `class="translate-x-[-180px] opacity-75 transition-base"` to the editor canvas.

**Step 5: Verify publish flow**

Test: full publish flow (select site, schedule, publish, social queue) works via the new panel.

**Step 6: Commit**

```bash
git add src/components/ui/SidePanel.tsx src/components/dashboard/PublishPanel.tsx src/app/editor/[id]/page.tsx
git commit -m "feat: convert PublishModal to side panel with live preview"
```

---

### Task 15: Restyle ImagePicker as SidePanel/BottomSheet

**Files:**
- Modify: `src/components/editor/ImagePicker.tsx` (515 lines)

**Step 1: Read current ImagePicker**

Understand the media library browser, search, pagination, upload, drag-drop, credit/alt text.

**Step 2: Refactor to use SidePanel**

- Desktop: opens as `<SidePanel>` from right (same 360px)
- Mobile: opens as bottom sheet variant
- Three tabs: Browse, Upload, AI Generate (placeholder for future)
- Recent uploads grid at top
- Drag-drop zone with `border-press-500 shadow-glow-crimson` on hover
- Mobile adds camera option (future enhancement — add placeholder button)

**Step 3: Verify image picking works**

Test: Browse, upload, select, close — all flows functional.

**Step 4: Commit**

```bash
git add src/components/editor/ImagePicker.tsx
git commit -m "feat: restyle ImagePicker as side panel with tabs"
```

---

## Phase 5: Analytics Hub

### Task 16: Redesign analytics page

**Files:**
- Modify: `src/app/analytics/page.tsx` (387 lines)

**Step 1: Read current analytics page**

Understand: real-time visitor count, top articles, sparklines, overview cards, leaderboard, period selector.

**Step 2: Implement new layout**

Top-to-bottom:
1. **Header row:** "ANALYTICS" terminal-label + period pills (7d/30d/90d) + live indicator (pulsing crimson dot + reader count)
2. **Performance Stream (full width):** Multi-line area chart (views in `press-500`, visitors in `paper-400`). Reuse existing data, render as SVG or use a lightweight chart lib (recharts is already a common choice — check if in deps, otherwise use inline SVG). Hover tooltips. Current value at right edge with glow dot.
3. **Leaderboard (left ~45%):** Writers ranked, crown for #1, horizontal fill bars in crimson gradient.
4. **Top Articles (right ~55%):** Horizontal bar chart per article with crimson gradient bars.
5. **Site Breakdown (left below leaderboard):** Horizontal bars per publish target.
6. **Reading Patterns (full width bottom):** Heatmap grid (day x hour). Use existing `/api/tracking/report` heatmap data. Three intensity levels with CSS background colors.

**Step 3: Visual treatments**

- No gridlines — just curves and labels
- Chart draw-in animation (CSS `clip-path` or Framer Motion)
- All numbers JetBrains Mono
- Green positive deltas, crimson negative

**Step 4: Verify data loads correctly**

Test: all period selections work, data matches previous page's data.

**Step 5: Commit**

```bash
git add src/app/analytics/page.tsx
git commit -m "feat: redesign analytics as Mission Control intelligence center"
```

---

## Phase 6: Social Queue

### Task 17: Redesign social queue page

**Files:**
- Modify: `src/app/social-queue/page.tsx` (292 lines)

**Step 1: Read current social queue page and supporting hooks**

Read the page and check for hooks like `useCreatePostModal`, `useSocialQueue` referenced in the tracking data.

**Step 2: Implement Broadcast Deck layout**

1. **Header:** "BROADCAST DECK" terminal-label + view tabs (Queue / Timeline / Activity) + "+ New Post" button
2. **Queue view (default):** Posts grouped by day (TODAY, TOMORROW, date), within each day grouped by time slot. Time column with JetBrains Mono + vertical timeline rail. Platform cards side-by-side (X + Facebook). Status badges with glow. Character counter.
3. **Timeline view:** Horizontal dot-on-line per day of week. Filled dot = approved, empty = pending, ring = sent. Gap detection with text callout.
4. **Activity view:** Reverse-chronological sent posts log (preserve existing activity view, restyle).
5. **Broadcast Stats Footer (44px):** Queued count, sent today, success rate, next scheduled.

**Step 3: Restyle post creation flow**

"+ New Post" opens a `<SidePanel>` (reuse from Task 14):
- Article selector dropdown
- AI caption generation per platform
- Platform toggles, schedule picker
- Preview cards
- "Queue" / "Send Now" buttons

**Step 4: Verify all social queue operations**

Test: view queue, approve, send now, create post, generate caption, timeline view.

**Step 5: Commit**

```bash
git add src/app/social-queue/page.tsx
git commit -m "feat: redesign social queue as Broadcast Deck with timeline view"
```

---

## Phase 7: Calendar

### Task 18: Redesign calendar page

**Files:**
- Modify: `src/app/calendar/page.tsx` (582 lines)

**Step 1: Read current calendar page**

Understand month/week views, article status visualization, publishing insights sidebar.

**Step 2: Implement Publishing Radar layout**

1. **Week view as default:** 5-column grid (Mon-Fri), articles stack vertically as mini cards. Status indicators: solid circle (published, crimson), outlined (scheduled), empty (draft), dotted (idea). Card shows truncated title, site abbreviation, views or time.
2. **Month view:** Preserved as secondary toggle, restyled to match.
3. **Pipeline summary bar (bottom):** Count by status (published/scheduled/drafts/ideas), progress bar, comparison to last week.
4. **Empty day:** Ghost `[+ New Article]` button.
5. Click card -> editor. Drag card -> reschedule (stretch goal, skip if complex).

**Step 3: Verify calendar navigation**

Test: week/month toggle, navigate months, click articles, status colors correct.

**Step 4: Commit**

```bash
git add src/app/calendar/page.tsx
git commit -m "feat: redesign calendar as Publishing Radar with week-first view"
```

---

## Phase 8: Mobile Polish

### Task 19: Mobile-specific refinements

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/editor/[id]/page.tsx`
- Modify: `src/components/layout/BottomNav.tsx`
- Modify: `src/app/globals.css`

**Step 1: Dashboard mobile**

- PulseBar: single row condensed (views + delta + sparkline, counts below)
- QueueList: full-width cards, action buttons become full-width tappable rows
- Story Ideas: collapsed to tappable row with count badge

**Step 2: Editor mobile**

- Full-width canvas (no margins)
- Toolbar docked to bottom above keyboard, `overflow-x-auto`
- Footer: word count + primary action only
- PublishPanel renders as bottom sheet (SidePanel already handles this)

**Step 3: Swipe gestures (stretch goal)**

If time permits, add:
- Swipe right on queue card → approve
- Swipe left → request revision

Use `touch` event listeners or a lightweight gesture library. Skip if too complex for this phase.

**Step 4: Test on mobile viewports**

Run: `npm run dev`, test at 375px and 390px widths in devtools.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: mobile polish for Mission Control — responsive dashboard, editor, nav"
```

---

## Phase 9: Final Polish

### Task 20: Page transitions and loading states

**Files:**
- Modify: `src/app/dashboard/loading.tsx`
- Modify: `src/app/analytics/loading.tsx`
- Modify: `src/app/social-queue/loading.tsx`
- Modify: `src/app/calendar/loading.tsx`

**Step 1: Add skeleton loading states**

Replace any existing loading spinners with skeleton shimmer screens that match the Mission Control layout of each page. Use the `.skeleton` CSS class added in Task 1.

Dashboard loading: shimmer blocks matching PulseBar shape, QueueList cards, TrendingPanel bars.

**Step 2: Add editor page transition**

When navigating from dashboard to editor, use Framer Motion `layoutId` on the article card to create the "card expands into editor" animation. This is the highest-impact micro-interaction.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: skeleton loading states and page transitions"
```

---

### Task 21: Final build verification and cleanup

**Step 1: Full build**

Run: `npm run build`
Fix any TypeScript or build errors.

**Step 2: Lint**

Run: `npm run lint`
Fix any lint errors.

**Step 3: Manual smoke test**

Navigate through every page: login -> dashboard -> editor -> publish -> analytics -> social queue -> calendar. Test dark mode toggle. Test mobile viewport. Verify all tracking events still fire.

**Step 4: Remove any unused imports, dead code, commented-out old code**

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and build verification for Mission Control redesign"
```

---

## Implementation Order Summary

| Phase | Tasks | Dependency | Est. Complexity |
|-------|-------|------------|-----------------|
| 0. Feature Flag | 0A-0E | None | Low |
| 1. Design System | 1-2 | Phase 0 | Low |
| 2. Navigation Shell | 3-6 | Phase 1 | Medium |
| 3. Dashboard | 7-12 | Phase 2 | High |
| 4. Editor + Publish | 13-15 | Phase 2 | High |
| 5. Analytics | 16 | Phase 2 | Medium |
| 6. Social Queue | 17 | Phase 2 | Medium |
| 7. Calendar | 18 | Phase 2 | Medium |
| 8. Mobile Polish | 19 | Phases 3-7 | Medium |
| 9. Final Polish | 20-21 | All | Low |

**Feature flag strategy:** All new UI is gated behind `uiVersion === 'mission-control'`. Only ADMINs see the toggle ("Newsroom 2.0: Revenge of the Sidebar"). Classic UI remains completely untouched. Each page uses the conditional rendering pattern from Task 0E.

**Schema change reminder (Task 0A):** Run `ALTER TABLE users ADD COLUMN ui_version TEXT NOT NULL DEFAULT 'classic';` on production BEFORE pushing the schema change to main.

**Parallelizable:** After Phase 2 completes, Phases 3-7 can be worked on in any order. Phases 3 and 4 are highest priority (62% of total usage).

**Critical path:** Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 8 -> Phase 9

**Rollout plan:**
1. Deploy with flag — only admins can toggle
2. Admins test for 1-2 weeks, report issues
3. When stable, flip default to `mission-control` for all users
4. After confirmation period, remove classic code and feature flag
