import express from 'express';
import {
  searchGetty,
  downloadGettyImage,
  closeContext,
  GettyConfigurationError,
  getGettyConfigurationError,
} from './getty';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const API_KEY = process.env.GETTY_WORKER_API_KEY || '';

// Simple API key auth middleware
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (API_KEY) {
    const provided = req.headers['x-api-key'] || req.query.apiKey;
    if (provided !== API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  next();
}

app.use(authMiddleware);

// Health check
app.get('/health', (_req, res) => {
  const configError = getGettyConfigurationError();
  res.status(configError ? 503 : 200).json({
    status: configError ? 'misconfigured' : 'ok',
    service: 'getty-worker',
    error: configError || undefined,
  });
});

// POST /search — search Getty Images, return results with thumbnails
app.post('/search', async (req, res) => {
  const { keywords, limit } = req.body as { keywords?: string; limit?: number };

  if (!keywords) {
    return res.status(400).json({ error: 'keywords is required' });
  }

  try {
    const results = await searchGetty(keywords, limit || 20);
    res.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[search] Error:', msg);
    res.status(err instanceof GettyConfigurationError ? 503 : 500).json({ error: msg });
  }
});

// POST /download — download a specific Getty asset
app.post('/download', async (req, res) => {
  const { assetId } = req.body as { assetId?: string };

  if (!assetId) {
    return res.status(400).json({ error: 'assetId is required' });
  }

  try {
    const result = await downloadGettyImage(assetId);
    if (!result) {
      return res.status(404).json({ error: 'Could not download image' });
    }
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[download] Error:', msg);
    res.status(err instanceof GettyConfigurationError ? 503 : 500).json({ error: msg });
  }
});

// POST /auto-image — generate keywords from headline, search, download best match
app.post('/auto-image', async (req, res) => {
  const { headline, excerpt } = req.body as { headline?: string; excerpt?: string };

  if (!headline) {
    return res.status(400).json({ error: 'headline is required' });
  }

  try {
    // Generate search keywords using Anthropic API
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 20,
        messages: [{
          role: 'user',
          content: `Give me a single 1-3 word Getty Images search phrase for this news article.\nHeadline: "${headline}"${excerpt ? `\nExcerpt: ${excerpt.substring(0, 300)}` : ''}\nOutput ONLY the phrase (e.g. "Iran Khamenei" or "Trump tariffs"). No numbers, no lists, no explanation.`,
        }],
      }),
    });

    if (!anthropicRes.ok) {
      console.error(`[auto-image] Anthropic API error: ${anthropicRes.status}`);
      return res.status(500).json({ error: 'Failed to generate search keywords' });
    }

    const aiData = await anthropicRes.json() as {
      content: Array<{ type: string; text?: string }>;
    };
    const keywords = aiData.content[0]?.type === 'text'
      ? (aiData.content[0].text?.trim() || headline.split(' ').slice(0, 3).join(' '))
      : headline.split(' ').slice(0, 3).join(' ');

    console.log(`[auto-image] Keywords: "${keywords}" for headline: "${headline.slice(0, 60)}..."`);

    // Search Getty
    const results = await searchGetty(keywords, 5);
    if (results.length === 0) {
      return res.json({ result: null, keywords, message: 'No search results found' });
    }

    // Download the first (best) result
    const downloaded = await downloadGettyImage(results[0].assetId);
    if (!downloaded) {
      return res.json({ result: null, keywords, message: 'Download failed' });
    }

    res.json({ result: downloaded, keywords });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[auto-image] Error:', msg);
    res.status(err instanceof GettyConfigurationError ? 503 : 500).json({ error: msg });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — closing browser context...');
  await closeContext();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received — closing browser context...');
  await closeContext();
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Getty worker listening on port ${PORT}`);
  console.log(`Getty email: ${process.env.GETTY_EMAIL ? '***' : '(not set)'}`);
  console.log(`Getty password: ${process.env.GETTY_PASSWORD ? '***' : '(not set)'}`);
  console.log(`Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '***' : '(not set)'}`);
});
