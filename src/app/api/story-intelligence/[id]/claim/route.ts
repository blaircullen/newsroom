import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

function extractArticleText(html: string): string {
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

  if (!articleHtml) {
    const bodyMatch = cleaned.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
    articleHtml = bodyMatch ? bodyMatch[1] : cleaned;
  }

  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(articleHtml)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').replace(/&\w+;/g, ' ').trim();
    if (text.length > 30) {
      paragraphs.push(text);
    }
  }

  if (paragraphs.length >= 3) {
    return paragraphs.join('\n\n');
  }

  return articleHtml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function generateAiDraft(
  headline: string,
  sourceUrl: string,
  suggestedAngles: string[]
): Promise<{ headline: string; subHeadline: string; bodyHtml: string } | null> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    console.error('[claim] No ANTHROPIC_API_KEY set');
    return null;
  }

  try {
    // Fetch source article
    console.log(`[claim] Fetching source: ${sourceUrl}`);
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsRoom/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[claim] Source fetch failed: HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();
    const articleText = extractArticleText(html);
    console.log(`[claim] Extracted ${articleText.length} chars from source`);

    if (articleText.length < 100) {
      console.error(`[claim] Extracted text too short (${articleText.length} chars)`);
      return null;
    }

    const anglesContext =
      suggestedAngles.length > 0
        ? `\n\nSUGGESTED ANGLES (use one of these as your primary angle if appropriate):\n${suggestedAngles.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
        : '';

    console.log('[claim] Calling Anthropic API...');
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
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
            content: `You are a senior editorial writer for a conservative news outlet that is strongly supportive of President Trump and his administration. Rewrite the following article in your own words.

EDITORIAL STANCE:
- Frame stories in a way that is favorable to President Trump and his administration's policies and achievements.
- When covering Trump administration actions, emphasize the positive impact and strong leadership.
- When covering opposition or criticism of Trump, present it skeptically and highlight any hypocrisy or inconsistency.
- Use language that reflects strength, decisiveness, and patriotism.
- If the story is neutral or unrelated to politics, still write with confident, America-first energy.

REQUIREMENTS:
1. Write a compelling, clickable HEADLINE — bold, direct, assertive. Headlines should reflect a pro-Trump, conservative perspective.
2. Write a punchy SUB-HEADLINE that adds context and urgency, reinforcing the editorial angle.
3. Rewrite the body in 4 to 5 paragraphs:
   - Direct and conversational tone
   - Confident and assertive — take a clear conservative angle
   - Punchy short sentences mixed with longer explanatory ones
   - Lead with the most impactful facts
   - End with a forward-looking statement
4. Format body in clean HTML with <p> tags. Do NOT use <strong>, <b>, or any bold formatting — just plain text in paragraphs. No <h1>/<h2> tags.
${anglesContext}

RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, no backticks, just raw JSON):
{
  "headline": "Your headline here",
  "subHeadline": "Your sub-headline here",
  "bodyHtml": "<p>First paragraph...</p><p>Second paragraph...</p>"
}

ORIGINAL HEADLINE: ${headline}

SOURCE ARTICLE:
${articleText.substring(0, 12000)}`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text().catch(() => '');
      console.error(`[claim] Anthropic API error: ${anthropicRes.status} ${errBody.slice(0, 300)}`);
      return null;
    }

    const data = await anthropicRes.json();
    const aiText = data.content?.[0]?.text;
    if (!aiText) {
      console.error('[claim] Anthropic returned empty content');
      return null;
    }

    const cleaned = aiText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.headline || !parsed.bodyHtml) {
      console.error('[claim] AI response missing headline or bodyHtml');
      return null;
    }

    console.log(`[claim] AI draft generated: "${parsed.headline.slice(0, 60)}..."`);
    return {
      headline: parsed.headline,
      subHeadline: parsed.subHeadline || '',
      bodyHtml: parsed.bodyHtml,
    };
  } catch (error) {
    console.error('[claim] AI draft generation failed:', error);
    return null;
  }
}

// POST — writer claims a story, creating a draft article with AI-generated body
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const story = await prisma.storyIntelligence.findUnique({
    where: { id },
  });

  if (!story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 });
  }

  if (story.claimedById) {
    return NextResponse.json({ error: 'Story already claimed' }, { status: 409 });
  }

  // Try to generate an AI draft from the source URL
  const suggestedAngles =
    story.suggestedAngles && Array.isArray(story.suggestedAngles)
      ? story.suggestedAngles.map(String)
      : [];

  const aiDraft = await generateAiDraft(story.headline, story.sourceUrl, suggestedAngles);

  const headline = aiDraft?.headline || story.headline;
  const subHeadline = aiDraft?.subHeadline || '';

  let body: string;
  if (aiDraft?.bodyHtml) {
    body = aiDraft.bodyHtml;
  } else if (suggestedAngles.length > 0) {
    body = `<p><em>${suggestedAngles[0]}</em></p>`;
  } else {
    body = '<p></p>';
  }

  const article = await prisma.article.create({
    data: {
      headline,
      subHeadline,
      body,
      authorId: session.user.id,
      status: 'DRAFT',
    },
  });

  await prisma.storyIntelligence.update({
    where: { id },
    data: {
      claimedById: session.user.id,
      claimedAt: new Date(),
      articleId: article.id,
      outcome: 'CLAIMED',
    },
  });

  return NextResponse.json({ success: true, articleId: article.id });
}
