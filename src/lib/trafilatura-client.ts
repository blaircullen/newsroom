interface TrafilaturaResult {
  text: string;
  title: string | null;
  author: string | null;
  date: string | null;
  sitename: string | null;
  url: string | null;
  success: boolean;
  error: string | null;
}

interface ExtractOptions {
  url?: string;
  html?: string;
  outputFormat?: 'text' | 'markdown' | 'json';
}

const TRAFILATURA_URL = process.env.TRAFILATURA_URL
  || (process.env.NODE_ENV === 'production' ? 'http://trafilatura:8000' : 'http://localhost:8000');
const TRAFILATURA_API_KEY = process.env.TRAFILATURA_API_KEY || '';

async function trafilaturaFetch(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${TRAFILATURA_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': TRAFILATURA_API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
}

export async function extractArticle(options: ExtractOptions): Promise<TrafilaturaResult> {
  const res = await trafilaturaFetch('/extract', {
    url: options.url,
    html: options.html,
    output_format: options.outputFormat || 'text',
  });
  if (!res.ok) {
    throw new Error(`Trafilatura error: ${res.status}`);
  }
  return res.json();
}

export async function isTrafilaturaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${TRAFILATURA_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
