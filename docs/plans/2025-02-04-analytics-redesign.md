# Analytics Tab Mobile Redesign

## Overview

Redesign the mobile Analytics tab to match the premium, Tesla-like dark aesthetic of the Home and Hot tabs. The current light newspaper-style design feels disconnected from the rest of the app.

## Design Decisions

- **Hero Metric**: Giant glowing number with animated glow effect
- **Trend Chart**: Animated bar chart showing 7-day performance
- **Leaderboard**: Glowing rank cards with gold/silver/bronze treatment
- **Accent Color**: Cyan/teal (`#00D9FF`) to differentiate from Home (red) and Hot (orange)

## Visual Language

### Background & Base
- Dark slate background (`bg-slate-900`) matching other tabs
- Glassmorphism elements with `bg-white/5` or `bg-white/10` + backdrop blur
- Remove `BottomNavLight` - use consistent dark floating nav

### Typography
- Gradient text for header ("Analytics" white-to-cyan)
- Clean sans-serif throughout
- Uppercase tracking for labels ("TOTAL VIEWS", "THIS WEEK")

### Accents
- Primary: Cyan glow (`cyan-400/500`) for metrics and charts
- Leaderboard: Gold (#B8860B), Silver (#71717A), Bronze (#A16207)
- Subtle animated glows on key elements

## Component Specifications

### 1. Hero Metric Section

```
┌─────────────────────────────────────┐
│         A N A L Y T I C S           │  ← Gradient header (white to cyan)
│     ✦ Your Performance              │  ← Sparkle icon, white/60
├─────────────────────────────────────┤
│                                     │
│           12,847                    │  ← 72px+, white with cyan shadow
│         views today                 │  ← text-sm, white/50
│                                     │
│  ┌───────┐ ┌───────┐ ┌───────┐     │
│  │  247  │ │   12  │ │ 1.2K  │     │  ← Glass pills (bg-white/5)
│  │publish│ │drafts │ │unique │     │
│  └───────┘ └───────┘ └───────┘     │
└─────────────────────────────────────┘
```

**Specs:**
- Hero number: `text-7xl font-bold` with `shadow-cyan-500/30`
- Number gradient: `bg-gradient-to-b from-white to-cyan-200 bg-clip-text`
- Subtle 2-3 second pulse animation on glow
- Secondary stats in horizontal glass pills with thin dividers

### 2. Weekly Bar Chart

```
┌─────────────────────────────────────┐
│ THIS WEEK                    2,847  │
│                              total  │
│ ┌───────────────────────────────┐  │
│ │          ▓▓                   │  │
│ │    ▓▓    ▓▓         ▓▓       │  │
│ │    ▓▓    ▓▓    ▓▓   ▓▓  ▓▓   │  │
│ │ ▓▓ ▓▓    ▓▓    ▓▓   ▓▓  ▓▓   │  │
│ │ ▓▓ ▓▓    ▓▓    ▓▓   ▓▓  ▓▓ ▓▓│  │
│ │ M  T  W  T  F  S  S          │  │
│ └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Specs:**
- Container: `bg-white/5 backdrop-blur-xl rounded-2xl p-4`
- Section label: `text-xs uppercase tracking-widest text-white/50`
- Bars: `bg-gradient-to-t from-cyan-500 to-cyan-400`
- Today's bar: Extra glow (`shadow-cyan-500/40`)
- Animation: Bars animate up from 0 with 50ms stagger
- Day labels: `text-[10px] text-white/40`
- Subtle grid lines at 25/50/75% marks (`bg-white/5`)

### 3. Top Performers Leaderboard

```
┌─────────────────────────────────────┐
│ TOP PERFORMERS                      │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │  ✦1  Nashville Chef Wins...    │ │  ← Gold glow on rank
│ │      by Sarah Chen   │ 4,231 👁│ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │   2  Downtown Development...   │ │  ← Silver glow
│ │      by Mike Torres  │ 2,847 👁│ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │   3  Music Row Expansion...    │ │  ← Bronze glow
│ │      by Jordan Lee   │ 1,923 👁│ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │   4  Local Business...         │ │  ← No glow, white/40
│ │      by Alex Kim     │   892 👁│ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Specs:**
- Card: `bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4`
- Rank colors:
  - #1: `text-amber-400 shadow-amber-500/50` (gold)
  - #2: `text-zinc-300 shadow-zinc-400/50` (silver)
  - #3: `text-orange-400 shadow-orange-500/50` (bronze)
  - #4+: `text-white/40` (no glow)
- Headline: `text-base font-semibold text-white line-clamp-2`
- Author: `text-xs text-white/50`
- Views: `text-sm text-cyan-400` with eye icon
- Hover/active: `bg-white/10`
- Top 3 ranks have subtle shimmer animation

### 4. Empty State

**When no published articles:**
- Centered layout with generous padding
- Chart icon: `text-cyan-500/30` with subtle glow
- Title: "No analytics yet" in white
- Subtitle: "Publish your first story to see performance data" in white/50
- Optional: Pulsing dotted circle animation around icon

## Implementation Changes

### Files to Modify

1. **`src/components/dashboard/AnalyticsSection.tsx`**
   - Complete rewrite with new dark design
   - Add bar chart component
   - Add animated number component
   - Remove all light theme styles

2. **`src/app/dashboard/page.tsx`**
   - Remove `BottomNavLight` usage for analytics tab
   - Update analytics wrapper div to use `bg-slate-900`

3. **`src/components/layout/BottomNav.tsx`**
   - Can remove `BottomNavLight` export entirely (optional cleanup)

### New Dependencies
- None required - all animations can be done with Tailwind + CSS

## Success Criteria

- Analytics tab visually matches Home and Hot tabs
- Dark background with glassmorphism cards
- Cyan accent color differentiates from other tabs
- Animated bar chart loads smoothly
- Leaderboard has premium gold/silver/bronze treatment
- Bottom nav is consistent across all tabs
- No visual jarring when switching between tabs
