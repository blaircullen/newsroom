# AI Article Review Feature

## Overview

Automatic AI-powered review of articles when submitted. Checks grammar, factual claims, and style. Articles still submit (no blocking), but get flagged with findings for editors to review.

## Design Decisions

- **Trigger**: Automatic on submit (status → SUBMITTED)
- **Blocking**: No - article submits, findings shown to editor
- **Check Types**: Grammar + Facts + Style (full review)
- **Visual Indicator**: Small shield badge on article cards

## Data Model

Add to Article model in `prisma/schema.prisma`:

```prisma
// AI Review fields
aiReviewedAt      DateTime?     @map("ai_reviewed_at")
aiReviewStatus    String?       @map("ai_review_status")  // "clean" | "has_issues" | "error"
aiReviewFindings  Json?         @map("ai_review_findings")
```

### Findings Structure

```typescript
interface AIFinding {
  type: 'grammar' | 'fact' | 'style';
  severity: 'error' | 'warning' | 'suggestion';
  text: string;           // The problematic text
  suggestion: string;     // What to fix
  explanation?: string;   // Why it's an issue
}
```

## API Design

### Endpoint: `POST /api/articles/[id]/ai-review`

**Request**: No body needed (reads article from DB)

**Response**:
```json
{
  "status": "has_issues",
  "reviewedAt": "2025-02-04T...",
  "findings": [
    {
      "type": "grammar",
      "severity": "error",
      "text": "Their going to the store",
      "suggestion": "They're going to the store",
      "explanation": "Incorrect homophone usage"
    },
    {
      "type": "fact",
      "severity": "warning",
      "text": "Crime rates have doubled since 2020",
      "suggestion": "Add citation or source",
      "explanation": "Statistical claim requires verification"
    }
  ]
}
```

### Claude Prompt

```
You are a newsroom editor reviewing an article for publication.
Check for:

GRAMMAR (severity: error)
- Spelling mistakes
- Grammatical errors
- Punctuation issues

FACTS (severity: warning)
- Claims that need citation/verification
- Statistics without sources
- Potentially misleading statements

STYLE (severity: suggestion)
- Readability improvements
- Awkward phrasing
- AP Style violations

Return JSON array of findings. If article is clean, return empty array.
```

## Visual Design

### Shield Badge on Article Cards

Shows on SUBMITTED+ status articles:

| Status | Icon | Color | Tooltip |
|--------|------|-------|---------|
| Clean | Shield + ✓ | Emerald/green | "AI Review: No issues found" |
| Has Issues | Shield + ! | Amber | "AI Review: 3 items to review" |
| Pending | Shield + spinner | Gray | "AI Review in progress..." |
| Error | Shield + ? | Gray | "AI Review failed" |

### Editor Review Panel

Collapsible panel at top of editor when viewing article with issues:

```
┌─────────────────────────────────────────────┐
│ 🛡️ AI Review Results              [Collapse]│
├─────────────────────────────────────────────┤
│ ⛔ GRAMMAR (1)                              │
│   "Their going" → "They're going"           │
│                                             │
│ ⚠️ FACTS (2)                                │
│   "doubled since 2020" - Needs citation     │
│   "sources say" - Vague attribution         │
│                                             │
│ 💡 STYLE (1)                                │
│   Consider shorter sentences in paragraph 3 │
└─────────────────────────────────────────────┘
```

**Color Coding**:
- Grammar: Red (`text-red-500`)
- Facts: Amber (`text-amber-500`)
- Style: Blue (`text-blue-400`)

## Implementation

### Files to Create/Modify

1. `prisma/schema.prisma` - Add AI review fields
2. `src/app/api/articles/[id]/ai-review/route.ts` - New endpoint
3. `src/components/dashboard/ArticleCard.tsx` - Add shield badge
4. `src/components/editor/AIReviewPanel.tsx` - New findings panel
5. `src/app/editor/[id]/page.tsx` - Integrate review panel
6. `src/app/api/articles/[id]/route.ts` - Trigger review on submit

### Trigger Integration

```typescript
// In PATCH handler when status changes to SUBMITTED
if (newStatus === 'SUBMITTED' && oldStatus !== 'SUBMITTED') {
  // Fire and forget - don't block response
  fetch(`${baseUrl}/api/articles/${id}/ai-review`, { method: 'POST' });
}
```

### Edge Cases

- AI review fails → set `aiReviewStatus: 'error'`
- Re-submit article → triggers fresh review
- Manual re-review available for editors

### Cost Control

- Uses Claude Haiku for speed/cost
- Only reviews on submit (not every save)
- Body truncated to 10,000 chars if longer

## Success Criteria

- [ ] AI review runs automatically on article submit
- [ ] Shield badge shows on article cards with correct status
- [ ] Editors can see detailed findings in review panel
- [ ] Review doesn't block submission flow
- [ ] Handles AI failures gracefully
