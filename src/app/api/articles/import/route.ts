import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// POST /api/articles/import - Import and rewrite an article from a URL
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admin-only feature
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'This feature is only available to administrators' },
      { status: 403 }
    );
  }

  const { url } = await request.json();

  if (!url || typeof url !== 'string') {
    return NextResponse.json(
      { error: 'A valid URL is required' },
      { status: 400 }
    );
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL format' },
      { status: 400 }
    );
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json(
      { error: 'AI service is not configured. Please set the ANTHROPIC_API_KEY environment variable.' },
      { status: 500 }
    );
  }

  try {
    // Step 1: Fetch the article content from the URL
    const articleResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsRoom/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!articleResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch article: HTTP ${articleResponse.status}` },
        { status: 400 }
      );
    }

    const html = await articleResponse.text();

    // Step 2: Extract meaningful text from the HTML
    const articleText = extractArticleText(html);

    if (articleText.length < 100) {
      return NextResponse.json(
        { error: 'Could not extract enough article content from the URL. The page may require JavaScript or be behind a paywall.' },
        { status: 400 }
      );
    }

    // Step 3: Call Anthropic API to rewrite the article
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `You are a senior editorial writer for a conservative news outlet that is strongly supportive of President Trump and his administration. Your task is to take the following article content and rewrite it completely in your own words.

EDITORIAL STANCE:
- Frame stories in a way that is favorable to President Trump and his administration's policies and achievements.
- When covering Trump administration actions, emphasize the positive impact and strong leadership.
- When covering opposition or criticism of Trump, present it skeptically and highlight any hypocrisy or inconsistency.
- Use language that reflects strength, decisiveness, and patriotism.
- If the story is neutral or unrelated to politics, still write with confident, America-first energy.

REQUIREMENTS:
1. Write a compelling, clickable HEADLINE that grabs attention — bold, direct, and assertive. Use strong action verbs and decisive language. Headlines should reflect a pro-Trump, conservative perspective. The headline should make the reader want to click immediately.
2. Write a punchy SUB-HEADLINE that adds context and urgency to the headline, reinforcing the editorial angle.
3. Rewrite the article body in 4 to 5 paragraphs. The tone should be:
   - Direct and conversational, like you're talking straight to the reader
   - Confident and assertive — take a clear conservative, pro-Trump angle on the story
   - Use punchy, short sentences mixed with longer explanatory ones
   - Include strong transitions between paragraphs
   - Lead with the most impactful facts
   - End with a forward-looking statement or call to attention
   - Write with energy and conviction — avoid dry, academic language
   - Use phrases that create urgency and importance

4. The body should be formatted in clean HTML with <p> tags for paragraphs. You may use <strong> for emphasis on key phrases and <a> tags if referencing specific entities. Do NOT use <h1>, <h2>, or other header tags in the body — just paragraphs.

RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, no backticks, just raw JSON):
{
  "headline": "Your compelling headline here",
  "subHeadline": "Your punchy sub-headline here",
  "bodyHtml": "<p>First paragraph...</p><p>Second paragraph...</p><p>Third paragraph...</p><p>Fourth paragraph...</p>",
  "bodyText": "Plain text version of the article without HTML tags"
}

Here is the source article content to rewrite:

${articleText.substring(0, 12000)}`,
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errData = await anthropicResponse.json().catch(() => ({}));
      console.error('Anthropic API error:', errData);
      return NextResponse.json(
        { error: 'AI service error. Please try again.' },
        { status: 502 }
      );
    }

    const anthropicData = await anthropicResponse.json();
    const aiText = anthropicData.content?.[0]?.text;

    if (!aiText) {
      return NextResponse.json(
        { error: 'AI returned an empty response. Please try again.' },
        { status: 502 }
      );
    }

    // Parse the AI response
    let parsed;
    try {
      // Clean up potential markdown fences
      const cleaned = aiText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiText.substring(0, 500));
      return NextResponse.json(
        { error: 'AI response was not in the expected format. Please try again.' },
        { status: 502 }
      );
    }

    // Validate the parsed response
    if (!parsed.headline || !parsed.bodyHtml) {
      return NextResponse.json(
        { error: 'AI response was incomplete. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      headline: parsed.headline,
      subHeadline: parsed.subHeadline || '',
      bodyHtml: parsed.bodyHtml,
      bodyText: parsed.bodyText || stripHtml(parsed.bodyHtml),
      sourceUrl: url,
    });
  } catch (error: any) {
    console.error('Import error:', error);

    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Timed out fetching the article. The URL may be unreachable.' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to import article' },
      { status: 500 }
    );
  }
}

/**
 * Extract readable article text from HTML.
 * Uses a simple approach: strips scripts/styles/nav, then extracts text from
 * article-like containers, falling back to the full body.
 */
function extractArticleText(html: string): string {
  // Remove scripts, styles, SVGs, navs, footers, headers, ads
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Try to find the main article content
  const articlePatterns = [
    /<article[\s\S]*?>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*(?:article|story|post|entry|content-body|story-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<main[\s\S]*?>([\s\S]*?)<\/main>/i,
  ];

  let articleHtml = '';
  for (const pattern of articlePatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1] && match[1].length > 200) {
      articleHtml = match[1];
      break;
    }
  }

  // Fall back to body if no article container found
  if (!articleHtml) {
    const bodyMatch = cleaned.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
    articleHtml = bodyMatch ? bodyMatch[1] : cleaned;
  }

  // Extract text from paragraphs for cleaner results
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(articleHtml)) !== null) {
    const text = stripHtml(m[1]).trim();
    if (text.length > 30) {
      paragraphs.push(text);
    }
  }

  if (paragraphs.length >= 3) {
    return paragraphs.join('\n\n');
  }

  // Fallback: strip all HTML and return
  return stripHtml(articleHtml)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip HTML tags from a string
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

