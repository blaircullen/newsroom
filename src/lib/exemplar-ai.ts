import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = [
  'politics',
  'economy',
  'culture',
  'immigration',
  'law-enforcement',
  'foreign-policy',
  'tech',
  'media',
  'health',
  'education',
  'energy',
  'military',
  'other',
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

export interface QuickPreview {
  category: Category;
  topics: string[];
  quickSummary: string;
}

export interface DeepFingerprint {
  topics: string[];
  keywords: Record<string, number>; // keyword -> weight 1.0–5.0
  tone: string;
  politicalFraming: string;
  headlineStyle: string;
  structureNotes: string;
  audienceAlignment: number; // 0–100
  strengthSignals: string[];
  similarToCategories: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

function isValidCategory(value: unknown): value is Category {
  return typeof value === 'string' && (VALID_CATEGORIES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// generateQuickPreview
// ---------------------------------------------------------------------------

export async function generateQuickPreview(
  title: string,
  content: string,
): Promise<QuickPreview> {
  const truncatedContent = content.slice(0, 3000);

  const systemPrompt = `You are a content classifier for a conservative news operation. Given an article title and opening content, classify the piece and extract key topics.

Valid categories: ${VALID_CATEGORIES.join(', ')}.

Respond only with valid JSON. No markdown, no explanation outside the JSON object.`;

  const userPrompt = `Classify this article and return a quick preview.

Title: ${title}
Content: ${truncatedContent}

Respond with JSON:
{
  "category": "<one of the valid categories>",
  "topics": ["topic1", "topic2", "topic3"],
  "quickSummary": "<1-2 sentence summary>"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText =
    response.content[0].type === 'text' ? response.content[0].text : '';

  const jsonText = stripMarkdownFences(rawText);
  const parsed = JSON.parse(jsonText);

  return {
    category: isValidCategory(parsed.category) ? parsed.category : 'other',
    topics: Array.isArray(parsed.topics)
      ? parsed.topics.filter((t: unknown) => typeof t === 'string')
      : [],
    quickSummary:
      typeof parsed.quickSummary === 'string' ? parsed.quickSummary : '',
  };
}

// ---------------------------------------------------------------------------
// generateDeepFingerprint
// ---------------------------------------------------------------------------

export async function generateDeepFingerprint(
  title: string,
  content: string,
  source: string,
): Promise<DeepFingerprint> {
  const truncatedContent = content.slice(0, 12000);

  const systemPrompt = `You are an editorial intelligence analyst for a conservative news operation. Given a full article, produce a detailed content fingerprint that captures its topical profile, rhetorical style, and audience fit.

Audience values: limited government, free markets, national security, rule of law, traditional American values.

Respond only with valid JSON. No markdown, no explanation outside the JSON object.`;

  const userPrompt = `Analyze this article and return a deep fingerprint.

Source: ${source}
Title: ${title}
Content: ${truncatedContent}

Respond with JSON:
{
  "topics": ["topic1", "topic2"],
  "keywords": { "keyword1": 3.5, "keyword2": 1.0 },
  "tone": "<e.g. 'alarmed', 'factual', 'optimistic', 'critical'>",
  "politicalFraming": "<brief description of how the piece frames its subject politically>",
  "headlineStyle": "<e.g. 'declarative', 'question-based', 'sensational', 'neutral'>",
  "structureNotes": "<brief notes on article structure, sourcing quality, narrative approach>",
  "audienceAlignment": 75,
  "strengthSignals": ["signal1", "signal2"],
  "similarToCategories": ["politics", "economy"]
}

keyword weights must be numbers between 1.0 and 5.0.
audienceAlignment must be an integer between 0 and 100.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText =
    response.content[0].type === 'text' ? response.content[0].text : '';

  const jsonText = stripMarkdownFences(rawText);
  const parsed = JSON.parse(jsonText);

  // Validate and sanitize keywords: must be Record<string, number> in [1.0, 5.0]
  const rawKeywords =
    typeof parsed.keywords === 'object' &&
    parsed.keywords !== null &&
    !Array.isArray(parsed.keywords)
      ? (parsed.keywords as Record<string, unknown>)
      : {};

  const keywords: Record<string, number> = {};
  for (const [k, v] of Object.entries(rawKeywords)) {
    if (typeof v === 'number') {
      keywords[k] = Math.min(5.0, Math.max(1.0, v));
    }
  }

  // audienceAlignment: clamp to [0, 100]
  const rawAlignment =
    typeof parsed.audienceAlignment === 'number'
      ? parsed.audienceAlignment
      : 50;
  const audienceAlignment = Math.min(100, Math.max(0, Math.round(rawAlignment)));

  return {
    topics: Array.isArray(parsed.topics)
      ? parsed.topics.filter((t: unknown) => typeof t === 'string')
      : [],
    keywords,
    tone: typeof parsed.tone === 'string' ? parsed.tone : '',
    politicalFraming:
      typeof parsed.politicalFraming === 'string' ? parsed.politicalFraming : '',
    headlineStyle:
      typeof parsed.headlineStyle === 'string' ? parsed.headlineStyle : '',
    structureNotes:
      typeof parsed.structureNotes === 'string' ? parsed.structureNotes : '',
    audienceAlignment,
    strengthSignals: Array.isArray(parsed.strengthSignals)
      ? parsed.strengthSignals.filter((s: unknown) => typeof s === 'string')
      : [],
    similarToCategories: Array.isArray(parsed.similarToCategories)
      ? parsed.similarToCategories.filter((s: unknown) => typeof s === 'string')
      : [],
  };
}
