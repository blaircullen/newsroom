/**
 * Conversational-query -> structured-filters parsing for Broadcast Cuts
 * search (docs/grabien-clipper-feature-design.md §5's /api/cuts/search route,
 * §6 item 6). Uses the existing Anthropic client per CLAUDE.md, same
 * markdown-fence-stripped JSON pattern as src/lib/exemplar-ai.ts (this repo
 * has no literal assistant-prefill helper elsewhere despite the design doc
 * mentioning one -- reusing the pattern that's actually proven here instead
 * of inventing a new one).
 *
 * Ambiguity is resolved by echoing `parsedFilters` back to the user as
 * chips (§4.2) -- this function never silently guesses a field it isn't
 * confident about; it leaves it undefined instead.
 */

import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_HAIKU } from '@/lib/ai-models';
import type { CutSearchFilters } from '@/lib/cuts';

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

const SYSTEM_PROMPT = `You extract structured search filters from a producer's plain-English request for a broadcast clip. Today's date, if relevant, will be given in the user message.

Return ONLY a JSON object (no markdown fences, no commentary) with this exact shape -- omit any key you can't confidently infer, do not guess:
{
  "person": "<person's name mentioned, or omit>",
  "show": "<TV show name mentioned, or omit>",
  "network": "<network/station abbreviation like FNC, MSNBC, CNN, or omit>",
  "date": "<YYYY-MM-DD in US Eastern time, or omit>",
  "timeWindow": "<HH:MM-HH:MM 24h in US Eastern time, or omit>"
}`;

/**
 * Parses a natural-language query into CutSearchFilters. Falls back to `{}`
 * (unfiltered) rather than throwing -- a failed parse should degrade to "show
 * everything, let the user narrow with chips," not break the search.
 */
export async function parseNlQuery(query: string, nowIso?: string): Promise<CutSearchFilters> {
  const trimmed = query.trim();
  if (!trimmed) return {};

  const userPrompt = nowIso
    ? `Current date/time (ISO, UTC): ${nowIso}\n\nRequest: ${trimmed}`
    : `Request: ${trimmed}`;

  let rawText: string;
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
    rawText = response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (error) {
    // Evidence preserved, not swallowed -- caller/logs can see the real cause;
    // the function itself still degrades gracefully to unfiltered search.
    console.error('cuts-nl-parse: Anthropic call failed', error);
    return {};
  }

  try {
    const parsed = JSON.parse(stripMarkdownFences(rawText));
    const filters: CutSearchFilters = {};
    if (typeof parsed.person === 'string') filters.person = parsed.person;
    if (typeof parsed.show === 'string') filters.show = parsed.show;
    if (typeof parsed.network === 'string') filters.network = parsed.network;
    if (typeof parsed.date === 'string') filters.date = parsed.date;
    if (typeof parsed.timeWindow === 'string') filters.timeWindow = parsed.timeWindow;
    return filters;
  } catch (error) {
    console.error('cuts-nl-parse: failed to parse model output as JSON', rawText, error);
    return {};
  }
}

/** Maps CutSearchFilters to the wrapper's raw /search body shape. */
export function filtersToGrabienSearchBody(filters: CutSearchFilters): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (filters.person) body.persons = filters.person;
  if (filters.show) body.shows = filters.show;
  if (filters.network) body.stations = filters.network;
  if (filters.date) {
    body.datefrom = filters.date;
    body.dateto = filters.date;
  }
  if (filters.timeWindow) {
    const [from, to] = filters.timeWindow.split('-');
    if (from) body.timefrom = from.trim();
    if (to) body.timeto = to.trim();
  }
  return body;
}
