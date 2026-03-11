/**
 * Getty Worker HTTP Client
 *
 * Calls the getty-worker Docker service to search/download Getty Images.
 * The worker handles browser automation (Playwright) for Getty's customer portal.
 */

const GETTY_WORKER_URL = process.env.GETTY_WORKER_URL || 'http://getty-worker:3001';
const GETTY_WORKER_API_KEY = process.env.GETTY_WORKER_API_KEY || '';

interface GettySearchResult {
  assetId: string;
  title: string;
  thumbnailUrl: string;
  detailUrl: string;
}

interface GettyDownloadResult {
  filePath: string;
  credit: string;
  title: string;
  assetId: string;
}

async function gettyFetch(endpoint: string, body: object): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (GETTY_WORKER_API_KEY) {
    headers['x-api-key'] = GETTY_WORKER_API_KEY;
  }

  const res = await fetch(`${GETTY_WORKER_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000), // Getty operations can be slow
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Getty worker ${endpoint} failed: ${res.status} ${errBody.slice(0, 200)}`);
  }

  return res.json();
}

/**
 * Search Getty Images for a given keyword phrase.
 * Returns array of results with thumbnails.
 */
export async function searchGettyImages(
  keywords: string,
  limit: number = 20
): Promise<GettySearchResult[]> {
  const data = await gettyFetch('/search', { keywords, limit });
  return data.results || [];
}

/**
 * Download a specific Getty image by asset ID.
 * The image is saved to the shared media volume by the worker.
 * Returns file path (relative to MEDIA_STORAGE_PATH) and metadata.
 */
export async function downloadGettyImage(assetId: string): Promise<GettyDownloadResult | null> {
  const data = await gettyFetch('/download', { assetId });
  return data || null;
}

/**
 * Auto-select and download a Getty image for an article.
 * Uses AI to generate search keywords from headline, then searches and downloads.
 */
export async function autoSelectGettyImage(
  headline: string,
  excerpt?: string
): Promise<GettyDownloadResult | null> {
  const data = await gettyFetch('/auto-image', { headline, excerpt });
  return data?.result || null;
}

/**
 * Check if the Getty worker is available.
 */
export async function isGettyWorkerAvailable(): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (GETTY_WORKER_API_KEY) {
      headers['x-api-key'] = GETTY_WORKER_API_KEY;
    }
    const res = await fetch(`${GETTY_WORKER_URL}/health`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
