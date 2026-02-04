# Responsive Dashboard Redesign

**Date:** February 3, 2026
**Status:** Approved
**Goal:** Replace separate mobile app with fully responsive single codebase

---

## Problem Statement

The current architecture has two separate implementations:
- `MobileApp.tsx` (779 lines) - Standalone mobile experience
- `dashboard/page.tsx` (889 lines) - Desktop dashboard with mobile detection

This causes:
- Safari crashes due to dynamic import complexity
- Code duplication (~40% overlap)
- Maintenance burden (bugs fixed twice)
- Inconsistent features between platforms

---

## Solution: Single Responsive Dashboard

Delete `MobileApp.tsx`. Make the dashboard fully responsive using Tailwind CSS breakpoints. No JavaScript mobile detection.

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| Mobile features | Simplified - some features desktop-only |
| Navigation | Bottom tabs (mobile) / Sidebar (desktop) via CSS |
| Visual theme | Dark theme throughout (no editorial experiment) |
| Breakpoint approach | Desktop-first |

---

## Breakpoints

```
lg+ (1024+):   Full desktop - sidebar, 4-col stats, full cards
md (768-1023): Tablet - sidebar, 2-col stats, medium cards
<md (0-767):   Mobile - bottom tabs, compact stats, minimal cards
```

---

## Desktop-Only Features

Hidden below `md` breakpoint:
- Pagination controls (use "Load More" on mobile)
- Sort dropdown
- Delete buttons on article cards
- "Refresh Analytics" button
- Detailed timestamps

---

## Navigation Architecture

**Desktop (md+)**
- Sidebar visible via `className="hidden md:flex"`
- Full navigation with icons and labels

**Mobile (<md)**
- Sidebar hidden
- Bottom tab bar visible via `className="md:hidden"`
- Four tabs: Home, Hot, Analytics, Profile

**Tab State**
- URL query param: `/dashboard?tab=home`
- Default to "home" when no param
- On desktop, ignore tab param - show full dashboard

---

## Component Structure

```
src/app/dashboard/page.tsx        - Single responsive page
src/components/
  ├── layout/
  │   ├── AppShell.tsx            - Add bottom nav support
  │   └── BottomNav.tsx           - Mobile tab bar (new)
  ├── dashboard/
  │   ├── ArticleCard.tsx         - Responsive article card (new)
  │   ├── StatsGrid.tsx           - Responsive stats (new)
  │   ├── HotSection.tsx          - Hot articles + Story Ideas (new)
  │   ├── AnalyticsSection.tsx    - Stats + top performers (new)
  │   └── ProfileSection.tsx      - User profile (new)
```

---

## Responsive Patterns

**Stats Grid**
```tsx
<div className="grid grid-cols-3 md:grid-cols-2 lg:grid-cols-4 gap-3">
```

**Article Card**
```tsx
// Desktop-only elements
<div className="hidden md:block">{thumbnail}</div>
<p className="hidden md:block">{subheadline}</p>
<button className="hidden md:block">{deleteButton}</button>

// Responsive text
<h3 className="text-sm md:text-base lg:text-lg">{headline}</h3>
```

**Conditional Tab Content (Mobile)**
```tsx
{(activeTab === 'home' || isDesktop) && <ArticleList />}
{(activeTab === 'hot' || isDesktop) && <HotSection />}
// isDesktop = useMediaQuery or just render all and hide via CSS
```

---

## Implementation Steps

1. **Create BottomNav component** - Mobile tab bar
2. **Create ArticleCard component** - Extract and make responsive
3. **Create section components** - HotSection, AnalyticsSection, ProfileSection
4. **Update AppShell** - Add bottom nav, responsive sidebar
5. **Refactor dashboard page** - Tab state, responsive layout
6. **Delete MobileApp.tsx** - Remove 779 lines
7. **Test on Safari** - Verify crash is fixed

---

## Success Criteria

- [ ] Works on iPhone Safari (no crashes)
- [ ] Desktop experience unchanged
- [ ] Mobile has bottom tab navigation
- [ ] All core features work on mobile
- [ ] Net code reduction of 300+ lines

---

## Files to Delete

- `src/components/mobile/MobileApp.tsx`

---

## Risk Mitigation

If Safari still crashes after this refactor, the problem is elsewhere (not in mobile detection). The simpler architecture will make debugging easier.
