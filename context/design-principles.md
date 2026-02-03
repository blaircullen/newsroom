# Design Principles

## Core Values

### 1. Users First
- Every design decision prioritizes user needs over aesthetic preferences
- Reduce cognitive load through clear information hierarchy
- Provide immediate, clear feedback for all interactions

### 2. Simplicity & Clarity
- Remove unnecessary elements and complexity
- Use progressive disclosure for advanced features
- Clear visual hierarchy guides users naturally

### 3. Consistency
- Maintain consistent patterns across all interfaces
- Reuse components rather than creating variants
- Follow established conventions users already understand

### 4. Accessibility (WCAG AA+)
- Minimum 4.5:1 contrast ratio for text
- Minimum 3:1 contrast ratio for UI elements
- Full keyboard navigation support
- Screen reader compatible with proper ARIA labels

## Visual Hierarchy

### Typography
- **Headings**: Clear size differentiation (1.5x step scale)
- **Body**: Optimal reading length (45-75 characters)
- **Line height**: 1.5 for body text, 1.2-1.3 for headings
- **Font weight**: Use weight to establish hierarchy, not just size

### Spacing System (8px Grid)
- `4px` - Tight spacing (related elements)
- `8px` - Default spacing
- `16px` - Section spacing
- `24px` - Component separation
- `32px` - Major section breaks
- `48px+` - Page-level spacing

### Color Usage
- **Primary**: Brand actions and key UI elements
- **Semantic**: Success (green), Warning (amber), Error (red), Info (blue)
- **Neutral**: Grays for text, borders, backgrounds
- **Never rely on color alone** to convey meaning

## Component Standards

### Buttons
- Clear visual hierarchy (primary, secondary, tertiary)
- Minimum touch target: 44x44px
- Visible focus states
- Loading states for async actions
- Disabled states with reduced opacity (not grayed out text)

### Forms
- Labels always visible (no placeholder-only labels)
- Clear error messages below fields
- Validation on blur, not just submit
- Required field indicators
- Logical tab order

### Tables
- Sortable columns where applicable
- Pagination for large datasets
- Row hover states
- Responsive: horizontal scroll or card view on mobile

### Modals
- Clear close button (X) in corner
- Click outside to dismiss (with confirmation for destructive actions)
- Focus trap while open
- Escape key to close

## Interaction Patterns

### Feedback
- Immediate visual response to all interactions
- Loading indicators for operations > 300ms
- Success/error states clearly communicated
- Toast notifications for background operations

### Navigation
- Current location always visible
- Breadcrumbs for deep hierarchies
- Consistent back/cancel behavior
- Preserve state when navigating away and back

### Error Handling
- Human-readable error messages
- Suggest resolution steps when possible
- Never show raw error codes to users
- Graceful degradation over hard failures

## Performance Considerations

- Optimize images (WebP, proper sizing)
- Lazy load below-fold content
- Skeleton loaders over spinners
- Minimize layout shift (CLS < 0.1)
