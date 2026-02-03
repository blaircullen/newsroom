# Style Guide

## Brand Colors

### Primary Palette
- **Primary**: `#3B82F6` (Blue 500) - Main actions, links
- **Primary Hover**: `#2563EB` (Blue 600)
- **Primary Light**: `#DBEAFE` (Blue 100) - Backgrounds, highlights

### Semantic Colors
- **Success**: `#10B981` (Emerald 500)
- **Warning**: `#F59E0B` (Amber 500)
- **Error**: `#EF4444` (Red 500)
- **Info**: `#3B82F6` (Blue 500)

### Neutrals
- **Text Primary**: `#111827` (Gray 900)
- **Text Secondary**: `#6B7280` (Gray 500)
- **Text Muted**: `#9CA3AF` (Gray 400)
- **Border**: `#E5E7EB` (Gray 200)
- **Background**: `#F9FAFB` (Gray 50)
- **Surface**: `#FFFFFF` (White)

### Dark Mode (if applicable)
- **Text Primary**: `#F9FAFB` (Gray 50)
- **Text Secondary**: `#9CA3AF` (Gray 400)
- **Background**: `#111827` (Gray 900)
- **Surface**: `#1F2937` (Gray 800)
- **Border**: `#374151` (Gray 700)

## Typography

### Font Family
- **Primary**: Inter, -apple-system, BlinkMacSystemFont, sans-serif
- **Monospace**: JetBrains Mono, Menlo, Monaco, monospace

### Type Scale
- `text-xs`: 12px / 16px line-height
- `text-sm`: 14px / 20px line-height
- `text-base`: 16px / 24px line-height
- `text-lg`: 18px / 28px line-height
- `text-xl`: 20px / 28px line-height
- `text-2xl`: 24px / 32px line-height
- `text-3xl`: 30px / 36px line-height
- `text-4xl`: 36px / 40px line-height

### Font Weights
- **Regular (400)**: Body text
- **Medium (500)**: Emphasis, labels
- **Semibold (600)**: Subheadings, buttons
- **Bold (700)**: Headings

## Spacing

### Base Unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Icon gaps, tight spacing |
| `space-2` | 8px | Default element spacing |
| `space-3` | 12px | Form field gaps |
| `space-4` | 16px | Card padding, section gaps |
| `space-5` | 20px | Component separation |
| `space-6` | 24px | Section padding |
| `space-8` | 32px | Major section breaks |
| `space-10` | 40px | Page margins |
| `space-12` | 48px | Hero spacing |

## Border Radius

- `rounded-sm`: 2px - Subtle rounding
- `rounded`: 4px - Default for small elements
- `rounded-md`: 6px - Buttons, inputs
- `rounded-lg`: 8px - Cards, modals
- `rounded-xl`: 12px - Large cards
- `rounded-full`: 9999px - Pills, avatars

## Shadows

- `shadow-sm`: Subtle elevation (inputs, small cards)
- `shadow`: Default card elevation
- `shadow-md`: Dropdown menus, popovers
- `shadow-lg`: Modals, dialogs
- `shadow-xl`: Toast notifications

## Component Tokens

### Buttons
```css
/* Primary */
background: var(--primary);
color: white;
padding: 8px 16px;
border-radius: 6px;
font-weight: 500;

/* Secondary */
background: transparent;
color: var(--primary);
border: 1px solid var(--border);

/* Destructive */
background: var(--error);
color: white;
```

### Inputs
```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: 6px;
padding: 8px 12px;
font-size: 14px;

/* Focus */
border-color: var(--primary);
box-shadow: 0 0 0 3px var(--primary-light);

/* Error */
border-color: var(--error);
```

### Cards
```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: 8px;
padding: 16px;
box-shadow: var(--shadow-sm);
```

## Animation

### Durations
- **Fast**: 150ms - Hovers, micro-interactions
- **Normal**: 200ms - Default transitions
- **Slow**: 300ms - Page transitions, modals

### Easing
- **Default**: `cubic-bezier(0.4, 0, 0.2, 1)` - ease-in-out
- **Enter**: `cubic-bezier(0, 0, 0.2, 1)` - ease-out
- **Exit**: `cubic-bezier(0.4, 0, 1, 1)` - ease-in

## Icons

- **Size**: 16px (sm), 20px (md), 24px (lg)
- **Stroke**: 1.5px for outlined icons
- **Color**: Inherit from text color
- **Library**: Lucide React (recommended)

## Responsive Breakpoints

- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px
