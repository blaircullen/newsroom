/**
 * grabien-api Wrapper HTTP Client
 *
 * Calls the grabien-api wrapper service (FastAPI, runs on Goat alongside the
 * harvested-cookie source -- see grabien-api repo's src/grabien_api/wrapper/)
 * to search Grabien NewsBase and submit/poll/download clip renders.
 *
 * Mirrors getty-client.ts's shape deliberately: same env-var convention
 * (<SERVICE>_URL / <SERVICE>_SECRET), same evidence-preserving error class,
 * same AbortSignal timeout pattern so a wedged wrapper returns a clean JSON
 * error instead of a CF/proxy timeout page the frontend can't parse.
 *
 * See docs/grabien-clipper-feature-design.md §5 for the full route contract
 * this backs, and §6 for what the wrapper itself does/doesn't guarantee yet.
 */

const GRABIEN_WRAPPER_URL = (process.env.GRABIEN_WRAPPER_URL || 'http://localhost:8790').replace(/\/+$/, '');
const GRABIEN_WRAPPER_SECRET = process.env.GRABIEN_WRAPPER_SECRET || '';

export interface GrabienCandidate {
  id?: number;
  fileid?: number;
  summary?: string;
  title?: string;
  station?: string;
  show?: string;
  date?: string;
  time?: string;
  [key: string]: unknown;
}

export interface GrabienClipJob {
  id: string;
  fileid: number;
  start_ms: number;
  end_ms: number;
  air_date: string;
  base_summary: string;
  expected_summary: string;
  stage: 'QUEUED' | 'SUBMITTING' | 'RENDERING' | 'DOWNLOADING' | 'RAW_READY' | 'FAILED';
  error_stage: string | null;
  error_message: string | null;
  mp4_path: string | null;
  metadata_path: string | null;
  created_at: number;
  updated_at: number;
}

export interface GrabienHealth {
  session_expired: boolean;
  last_error: string | null;
  queue_depth: number;
}

export class GrabienWrapperError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'GrabienWrapperError';
  }
}

async function grabienFetch(
  method: 'GET' | 'POST',
  endpoint: string,
  body?: object
): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (GRABIEN_WRAPPER_SECRET) {
    headers['X-Wrapper-Secret'] = GRABIEN_WRAPPER_SECRET;
  }

  let res: Response;
  try {
    res = await fetch(`${GRABIEN_WRAPPER_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // Real search latency is ~16s backend-measured (§5); cap comfortably
      // above that but below Cloudflare's ~100s proxy limit, same reasoning
      // as getty-client.ts's 75s cap.
      signal: AbortSignal.timeout(75000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new GrabienWrapperError(`grabien-api wrapper is unreachable at ${GRABIEN_WRAPPER_URL}: ${detail}`);
  }

  if (!res.ok) {
    // Upstream errors pass through verbatim (§5's own contract note) -- never
    // collapsed to a generic string, per house constraint #6.
    const errBody = await res.text().catch(() => '');
    let message = errBody.slice(0, 500);
    try {
      const data = JSON.parse(errBody) as { detail?: string };
      if (data.detail) message = data.detail;
    } catch {
      // Keep raw response text.
    }
    throw new GrabienWrapperError(message || res.statusText, res.status);
  }

  return res.json();
}

export async function searchGrabien(filters: Record<string, unknown>): Promise<GrabienCandidate[]> {
  const data = await grabienFetch('POST', '/search', filters);
  return data.candidates || [];
}

export async function createGrabienClip(params: {
  fileid: number;
  start_ms: number;
  end_ms: number;
  air_date: string;
  summary: string;
}): Promise<GrabienClipJob> {
  return grabienFetch('POST', '/clips', params);
}

export async function getGrabienClip(jobId: string): Promise<GrabienClipJob> {
  return grabienFetch('GET', `/clips/${jobId}`);
}

export async function retryGrabienClip(jobId: string): Promise<GrabienClipJob> {
  return grabienFetch('POST', `/clips/${jobId}/retry`);
}

export async function getGrabienHealth(): Promise<GrabienHealth | null> {
  try {
    const res = await fetch(`${GRABIEN_WRAPPER_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Builds the wrapper's direct file URL -- used server-side by the proxy route. */
export function grabienClipFileUrl(jobId: string): string {
  return `${GRABIEN_WRAPPER_URL}/clips/${jobId}/file`;
}

export function grabienWrapperSecretHeader(): Record<string, string> {
  return GRABIEN_WRAPPER_SECRET ? { 'X-Wrapper-Secret': GRABIEN_WRAPPER_SECRET } : {};
}
