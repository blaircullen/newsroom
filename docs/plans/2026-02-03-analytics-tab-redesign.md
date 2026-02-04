# Analytics Tab Redesign: "The Masthead"

**Date:** February 3, 2026
**Status:** Approved
**Goal:** Transform the mobile Analytics tab into a bold, editorial design inspired by NYT/Apple News

---

## Design Direction

A newspaper front-page aesthetic where the day's stats are the headline. Strong typography, high contrast, content-forward. Inverts the current dark theme to a cream/off-white background with black text.

---

## Color Palette

| Purpose | Color | Hex |
|---------|-------|-----|
| Background | Cream | `#FAFAF8` |
| Primary text | Near-black | `#1A1A1A` |
| Secondary text | Warm gray | `#6B6B6B` |
| Positive accent | Forest green | `#1D7D4D` |
| Rank badges | Deep blue | `#1E40AF` |
| Gold (1st) | Gold | `#B8860B` |
| Silver (2nd) | Silver | `#71717A` |
| Bronze (3rd) | Bronze | `#A16207` |

---

## Section 1: Header

- **Title:** "Analytics" in bold black, 24px
- **No icon** - typography only
- **Dateline:** "Today, February 3" in small caps, 11px, muted gray
- **Background:** Solid cream, no blur effects

---

## Section 2: Hero Stat

The total views dominates the top third of screen:

```
12,847
views today
```

- **Number:** 56px, bold, black
- **Label:** 14px, light gray, below the number
- **Alignment:** Left-aligned with page padding

---

## Section 3: Secondary Stats Row

Three stats in a horizontal row with vertical dividers:

```
847 unique  |  12 published  |  3 drafts
```

- **Size:** 12px uppercase, wide letter-spacing
- **Color:** Muted gray
- **Dividers:** 1px vertical lines, light gray

---

## Section 4: Top Performers Leaderboard

### Section Header
- Horizontal rule (1px, light gray) as separator
- "TOP PERFORMERS" label: 11px, small caps, wide tracking, muted gray

### Article Rows

```
1   Republicans REJECT Clinton Last-Minute Deal,
    Push for Congress Vote
    by Sarah Chen · 3,578 views
```

- **Rank number:** 24px, bold, in circle with border
  - 1st place: Gold border (#B8860B)
  - 2nd place: Silver border (#71717A)
  - 3rd place: Bronze border (#A16207)
  - 4th-5th: Gray border
- **Headline:** 16px, bold, black, max 2 lines
- **Byline:** 12px, gray. Format: "by {author} · {views} views"
- **Row padding:** 16px vertical between items

### Empty State
- Centered text: "No published stories yet."
- Subtext: "Your top performers will appear here."
- Subtle newspaper icon above

---

## Section 5: Bottom Navigation

Minimal text-based navigation:

```
Home        Hot        Analytics        Profile
```

- **Labels:** 12px, medium weight
- **Active state:** Black text + 2px dot underneath (centered)
- **Inactive state:** Gray text, no decoration
- **Background:** Solid cream, no border/shadow

---

## Interactions

- **Tap article row:** Subtle cream-to-gray background fade
- **Pull-to-refresh:** Text flash "Updated just now" at top, fades after 1.5s

---

## Typography

- System font throughout (SF Pro on iOS)
- Headlines: Bold weight
- Body: Regular weight
- Numbers: Tabular numerals for alignment
- No custom fonts (performance)

---

## Implementation Notes

1. Update `AnalyticsTab` component in `MobileApp.tsx`
2. Create new color classes or use inline Tailwind
3. Keep existing data fetching logic unchanged
4. Test on both light and dark system settings (this design is light-only)
