# Mission Control Redesign

**Date:** 2026-02-17
**Status:** Approved
**Scope:** Full experience redesign — navigation, dashboard, editor, publish flow, analytics, social queue, calendar, mobile, design system

## Context

The Newsroom UI has evolved organically through feature additions. This redesign unifies the experience under a **"Mission Control"** concept — a Bloomberg-meets-Figma command center aesthetic that elevates visual sophistication while preserving the Ink/Press/Paper brand identity.

### Design Principles

1. **Usage-driven priority** — Feature usage data determines layout hierarchy
2. **Density where it matters, focus where it doesn't** — Dashboard is data-dense; editor is distraction-free
3. **Role-based scaling** — Admins see the full command center; writers see a simplified view
4. **Glow as signature** — Crimson glow treatments transform "clean editorial" into "command center"
5. **Side panels over modals** — Keep context visible; don't block the working view

### Feature Usage Data (production, all time)

| Rank | Feature | Events | % of Total |
|------|---------|--------|------------|
| 1 | Dashboard | 380 | 33% |
| 2 | Editor | 335 | 29% |
| 3 | Publish Modal | 127 | 11% |
| 4 | Image Picker | 69 | 6% |
| 5 | Analytics Hub | 68 | 6% |
| 6 | Story Ideas | 66 | 6% |
| 7 | Social Queue | 62 | 5% |
| 8 | Calendar | 10 | <1% |
| 9 | Daily Recap | 5 | <1% |

Users: 79% ADMIN, 21% WRITER. Core loop: **Dashboard -> Editor -> Publish -> Repeat**.

---

## 1. Navigation & Shell

Replace the left sidebar with a **persistent horizontal top bar** and **live wire ticker**.

### Top Bar (56px)

```
+--------------------------------------------------------------------------+
| * NR   Dashboard  Editor  Analytics  Social  Calendar    Cmd+K   Bell [BC] |
+--------------------------------------------------------------------------+
```

- **Left:** NR logo mark (crimson dot + NR monogram)
- **Center:** Nav links — Dashboard, Editor, Analytics, Social, Calendar
- **Active link:** Glowing crimson underline (`box-shadow: 0 2px 8px rgba(212,43,43,0.4)`)
- **Right:** Command palette trigger (Cmd+K), notification bell with count badge, user avatar
- **Background:** `ink-950`

### Wire Ticker (32px)

```
+--------------------------------------------------------------------------+
| > WIRE: Blair published "Trump Signs Executive Order" * 4m ago | Liz ... |
+--------------------------------------------------------------------------+
```

- Horizontally scrolling feed of real-time activity: publishes, submissions, social posts
- `ink-800` background, `paper-200` text
- Each event: relative timestamp + user attribution, clickable to navigate
- Collapsible via chevron toggle (persisted to localStorage)

### Mobile Navigation

- Top bar collapses to: NR logo + hamburger + notification bell
- Wire ticker hidden on mobile
- Bottom nav: 5 icons (Dashboard, Editor, Analytics, Social, More)
- Active tab: crimson icon with glow + label; inactive: `paper-500` icon, no label

### Why Horizontal Nav

- Frees full viewport width for content (no 64-256px sidebar)
- Wire ticker creates a "living" feel — the app always shows activity
- Command palette (Cmd+K) promoted to visible button

---

## 2. Dashboard — The Command Surface

Modular widget grid optimized around the core loop: see what needs attention, write/edit, publish.

### PULSE Bar (full width, top)

```
+----------------------------------------------------------------------+
|  * 12.4k      ^ 847        # 54          T 3:42         E 7          |
|  views today   +12%         published      avg read       drafts     |
|  [sparkline]  from yest    this week       time           in queue   |
+----------------------------------------------------------------------+
```

- 5 key metrics in a single horizontal strip with inline spark charts
- Views today (mini area chart, hourly), delta from yesterday, published this week, avg read time, drafts in queue
- Drafts count gets glowing crimson dot if any need review (admin only)
- JetBrains Mono for all numbers
- Each metric clickable — navigates to deeper view
- `ink-900` background with subtle gradient

### QUEUE (left column, ~60%)

- Prioritized action queue replacing the current article list
- **"Needs Action" count** with pulsing crimson indicator
- Admin: articles awaiting review. Writer: drafts and revision requests.
- Each card: status bar (left edge, color-coded), title, author, status, time, action buttons
- Right edge **readiness indicator**: filled circle = ready to publish, empty = needs work
- Tab toggle: "My Drafts" vs "All Pending" (admin sees both)
- Cards clickable — open directly into editor
- Left-border glow: crimson (submitted), amber (in review), ink (draft)

### TRENDING (right column, ~40%)

- Top performing articles with horizontal bar charts (relative performance)
- Percentage change indicators
- Social reach summary + optimal posting time suggestion
- Data from Umami, refreshed every 5 minutes

### STORY IDEAS (full width, bottom)

- Compact horizontal scrollable cards
- Each: headline suggestion, source (Fox lead, trending on X, competitor), recency
- Actions: "Draft It" (opens editor pre-filled) and "Dismiss"

### Role-Based Density

**Admin/Editor:** Full PULSE bar, all writers' articles in queue, review/approve actions.

**Writer:** Simplified PULSE (my views, my published, my drafts), own articles only, "Continue Editing" and "Submit" actions.

---

## 3. Editor — Focused Writing Environment

Contrasts with the data-dense dashboard. When writing, the command center falls away — **distraction-free canvas** inspired by iA Writer.

### Layout

**Editor Top Bar (48px):**
- Left: `<- Dashboard` back link
- Center: Article title (truncated) + live status badge with pulsing dot
- Right: Preview toggle, overflow menu (version history, delete, duplicate)
- `ink-950` background (slightly darker than main nav)

**Writing Canvas (center, max-width 680px):**
- Centered column with generous margins
- Featured image at top, full-width within column
- Title: Playfair Display, `display-lg` (2.5rem), `paper-50`
- Byline: Source Sans 3, `paper-400`
- Body: Source Sans 3, 18px, line-height 1.75, `paper-200`
- Background: pure `ink-950` — no cards, no borders

**Floating Toolbar:**
- Appears **inline** when text is selected (Medium/Notion pattern)
- Compact pill: Bold, Italic, Underline, Heading, Blockquote, Link, Image, Embed, AI (sparkle icon)
- Persistent bottom toolbar when no text selected
- `ink-800` background, `paper-100` icons, `press-500` active states
- AI button: generates continuation, suggests headlines, rewrites selection

**Status Footer (44px, sticky bottom):**
- Left: Auto-save indicator ("Saved 12s ago" with pulse on save)
- Center: Word count + read time (JetBrains Mono)
- Right: "Save Draft" (secondary) + "Submit" (primary, crimson glow)

### Focus Mode

Double-click editor or `Cmd+\` hides top bar and footer — pure writing canvas.

### Transition

Dashboard-to-editor: article card "expands" into full editor (zoom-in animation, spatial continuity).

---

## 4. Publish Panel

Replace the current publish modal with a **side panel** that slides from the right (360px).

```
+--------------------------------------------+--------------------------+
|                                            | PUBLISH                  |
|         [Editor content shifts             | Site: [Hannity.com v]    |
|          left, stays readable              | Category: [Politics v]   |
|          but dimmed]                       | Tags: immigration, exec  |
|                                            |                          |
|                                            | PREVIEW                  |
|                                            | [Mini preview card]      |
|                                            |                          |
|                                            | Schedule:                |
|                                            | o Publish now            |
|                                            | o Schedule for:          |
|                                            |   [date] [time]          |
|                                            |                          |
|                                            | Social:                  |
|                                            | [x] Auto-queue X post    |
|                                            | [x] Auto-queue FB post   |
|                                            |                          |
|                                            | [* PUBLISH TO SITE]      |
+--------------------------------------------+--------------------------+
```

- 300ms ease-out slide animation
- Editor content shifts left and dims (not hidden — reference while publishing)
- Site selector, category/tags (AI auto-suggested), live preview card
- Schedule: "Now" vs datetime picker
- Social auto-queue checkboxes (creates X and Facebook posts on publish)
- Publish button: full-width, crimson with glow
- Escape or click outside to close

### Why Panel > Modal

The publish modal (127 events, 3rd most used) blocks the editor. Side panel lets writers reference their article while setting metadata and see live preview alongside content.

---

## 5. Image Picker

Opens as **bottom sheet (mobile)** / **side panel (desktop)** — consistent with publish panel pattern.

- Three tabs: Browse (existing uploads), Upload, AI Generate
- Drag-and-drop zone with crimson glow border on hover
- Recent uploads grid at top for quick re-use
- Mobile: adds camera option

---

## 6. Analytics Hub — Intelligence Center

Transforms from reporting page into **real-time intelligence dashboard**.

### Live Indicator (top right)

- Pulsing crimson dot + active reader count from Umami real-time API
- Updates every 30 seconds

### Performance Stream (full width)

- Multi-line area chart: views (`press-500`), unique visitors (`paper-400`), social referrals (cyan accent)
- Hover for tooltips, current value at right edge with glowing dot
- Delta comparison vs previous period
- Period selector: 7d / 30d / 90d pills

### Leaderboard (left, ~45%)

- Writers ranked by total views in selected period
- Crown icon for #1
- Horizontal fill bar (crimson gradient)
- Article count + total views
- Click writer to filter entire page

### Top Articles (right, ~55%)

- Horizontal bar chart per article (crimson gradient bars)
- Title, author, age, target site
- Click to open editor or analytics detail

### Site Breakdown (left, below leaderboard)

- Horizontal bars per publish target
- Traffic distribution across all sites

### Reading Patterns (full width, bottom)

- Heatmap: day of week x hour of day
- Three intensities: low (`ink-700`), medium (`ink-500`), peak (`press-500` + glow)
- Automated insight: "Best window: Wed-Thu 12-2pm"
- Informs optimal posting time on dashboard and social queue

### Visual Treatments

- No gridlines/axis clutter — just data curves and labels
- Charts draw in with left-to-right reveal (500ms)
- All numbers JetBrains Mono, locale-formatted
- Green for positive deltas, crimson for negative

---

## 7. Social Queue — Broadcast Deck

### Views

- **Queue** (default): Chronological upcoming posts grouped by day
- **Timeline**: Horizontal dot-on-line layout per day — visual gap detection
- **Activity**: Reverse-chronological log of sent posts with engagement

### Queue View

Posts grouped by scheduled time within day sections (TODAY, TOMORROW, etc.).

Each time slot:
- Filled circle (ready) or empty circle (pending)
- Platform cards side-by-side: X and Facebook for same article
- Platform identity via icon + brand color accent on card header

Post cards:
- Status badge: green (Approved), amber (Pending), red (Failed)
- Caption preview (3 lines), thumbnail, character counter
- Actions: Edit, Send Now, Approve (admin), AI Regenerate

### Timeline View

```
        6am    9am    12pm    3pm    6pm    9pm
Mon    ----------*-------*---------------------
Tue    ----------------*--------*-----*--------
Wed    ------*--------------*------------------
Thu    ----------------------------------------  (gap detected)
Fri    ----------*--------------*--------------
```

- Visual gap detection with automated suggestion when a day has no posts
- Hover dot for preview, click to edit
- Answers "are we posting consistently?" at a glance

### Broadcast Stats Footer (44px)

Persistent strip: queued count, sent today, success rate, next scheduled time.

### New Post Flow

`[+ New Post]` opens creation side panel:
- Select article to promote
- AI auto-generates captions per platform
- Platform toggles, schedule picker (suggests based on Reading Patterns data)
- Preview cards
- "Queue" (saves for approval) or "Send Now" (admin)

---

## 8. Calendar — Publishing Radar

**Week view as default** (not month) — shows this week's publishing pipeline.

### Week View

- Each day is a column; articles stack vertically as cards
- Status indicators: solid circle (published), outlined circle (scheduled), empty circle (draft), dotted circle (idea)
- Card shows: truncated title, site abbreviation (HN/LP/JP/RR), views or scheduled time
- Click to open editor, drag to reschedule
- Month view available via toggle

### Pipeline Summary Bar (bottom)

- Count by status: published, scheduled, drafts, ideas
- Progress bar showing pipeline fullness
- Comparison to last week

### Empty Day Treatment

Days with no content show `[+ New Article]` ghost button.

---

## 9. Mobile Experience

Purpose-built companion, not a shrunk desktop.

### Mobile Dashboard

- PULSE condensed to single row: views + delta + sparkline, counts below
- Queue cards full width, stacked — action buttons become full-width tappable rows
- Pull-to-refresh with crimson spinner
- Story Ideas collapsed to tappable row with count badge

### Mobile Editor

- Full-width writing canvas
- Toolbar docked to bottom above keyboard, horizontally scrollable
- Simplified footer: word count + primary action
- Publish panel becomes bottom sheet (85% viewport)
- Image picker also bottom sheet with camera option

### Mobile Gestures

- Swipe right on queue card: quick approve (green flash)
- Swipe left: request revision (amber flash, comment input)
- Long press: context menu (edit, publish, delete, share)
- Pull down on dashboard: refresh all data

---

## 10. Design System

### Color System

**Preserved palettes:** ink-50 through ink-950, press-50 through press-950, paper-50 through paper-400.

**New signal colors:**

| Token | Value | Use |
|-------|-------|-----|
| `signal-live` | `#EF4444` | Live indicators |
| `signal-success` | `#22C55E` | Approved, published |
| `signal-warning` | `#F59E0B` | Pending, in review |
| `signal-danger` | `#EF4444` | Failed, rejected |

**New glow tokens:**

| Token | Value |
|-------|-------|
| `glow-crimson` | `0 0 20px rgba(212,43,43,0.3)` |
| `glow-live` | `0 0 12px rgba(239,68,68,0.4)` |
| `glow-success` | `0 0 12px rgba(34,197,94,0.3)` |

### Typography

| Role | Font | Weight | Size | Use |
|------|------|--------|------|-----|
| Display | Playfair Display | 700 | 2.5rem | Article titles, page h1 |
| Body | Source Sans 3 | 400/600 | 1rem | Body text, UI labels |
| Data | JetBrains Mono | 400/500 | 0.875rem | Numbers, stats, counters |
| Terminal | JetBrains Mono | 500 | 0.75rem | Section headers, badges |

**Terminal convention:** All section headers (PULSE, QUEUE, TRENDING) use uppercase JetBrains Mono at 0.75rem with `letter-spacing: 0.1em` in `paper-400`.

### Surface Tokens

| Token | Light | Dark |
|-------|-------|------|
| `page-bg` | `paper-50` | `ink-950` |
| `card-bg` | `white` | `ink-900` |
| `card-border` | `paper-200` | `ink-700` |
| `card-hover-border` | `paper-300` | `ink-600` |
| `elevated-bg` | `white` | `ink-850` |
| `footer-bg` | `paper-100` | `ink-900` |

### Interactive Tokens

| Token | Light | Dark |
|-------|-------|------|
| `button-primary-bg` | `press-600` | `press-500` |
| `button-primary-glow` | `glow-crimson` | `glow-crimson` |
| `button-secondary-bg` | `paper-200` | `ink-800` |
| `nav-active` | `press-600` underline | `press-500` + glow |
| `nav-inactive` | `ink-600` | `paper-500` |

### Animation Tokens

| Token | Value | Use |
|-------|-------|-----|
| `transition-fast` | `150ms ease` | Hover states, toggles |
| `transition-base` | `300ms ease-out` | Panel slides, card elevation |
| `transition-slow` | `500ms ease-out` | Chart draw-in, page transitions |
| `transition-spring` | `300ms cubic-bezier(0.34,1.56,0.64,1)` | Card expand, modal entry |
| `pulse-live` | `1.5s infinite` | Live indicators |
| `count-up` | `400ms per digit` | Number animations on load |

### Interaction Pattern Changes

| Pattern | Current | Mission Control |
|---------|---------|-----------------|
| Navigation | Sidebar (64-256px) | Top bar (56px) + wire ticker (32px) |
| Secondary content | Page navigation | Side panels (360px, slide from right) |
| Modals | Centered overlay | Bottom sheets (mobile), side panels (desktop) |
| Status | Color-coded badges | Badges + glow + pulse for urgent |
| Data display | Text/numbers | JetBrains Mono + sparklines + animated counters |
| Empty states | Text message | Illustration + CTA button |
| Loading | Spinner | Skeleton screens with shimmer animation |

### Accessibility

- All glow effects decorative — information conveyed through color AND text/icon
- `prefers-reduced-motion` disables: pulse, count-up, chart draw-in, ticker scroll
- Contrast: `paper-100` on `ink-950` = 15.3:1 (exceeds AAA)
- Focus rings: 2px `press-500` with 2px offset
- Skip-to-content link preserved
- All interactive elements keyboard accessible
