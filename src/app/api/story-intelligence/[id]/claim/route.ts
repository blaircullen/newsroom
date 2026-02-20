import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateQuickPreview, generateDeepFingerprint } from '@/lib/exemplar-ai';

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

// ---------------------------------------------------------------------------
// Helpers for multi-source fetching and labeling
// ---------------------------------------------------------------------------

interface SourceInfo {
  name: string;
  url: string;
}

function getSourceLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const isX = host === 'x.com' || host === 'twitter.com';
    if (isX) {
      const account = parsed.pathname.split('/')[1];
      return account ? `${account} on X` : 'X';
    }
    // Map common domains to friendly names
    const domainMap: Record<string, string> = {
      'foxnews.com': 'Fox News', 'dailywire.com': 'The Daily Wire',
      'breitbart.com': 'Breitbart', 'nypost.com': 'The New York Post',
      'bizpacreview.com': 'BizPac Review', 'thegatewaypundit.com': 'The Gateway Pundit',
      'freebeacon.com': 'The Free Beacon', 'washingtontimes.com': 'The Washington Times',
      'dailycaller.com': 'The Daily Caller', 'newsmax.com': 'Newsmax',
      'oann.com': 'OANN', 'reuters.com': 'Reuters', 'apnews.com': 'AP News',
      'cnn.com': 'CNN', 'nbcnews.com': 'NBC News', 'cbsnews.com': 'CBS News',
      'abcnews.go.com': 'ABC News', 'bbc.com': 'BBC', 'nytimes.com': 'The New York Times',
      'washingtonpost.com': 'The Washington Post', 'politico.com': 'Politico',
      'thehill.com': 'The Hill', 'townhall.com': 'Townhall',
    };
    return domainMap[host] || host;
  } catch {
    return url;
  }
}

async function fetchSourceContent(url: string): Promise<{ url: string; label: string; text: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`[claim] Source fetch failed for ${url}: HTTP ${res.status}`);
      return null;
    }
    const html = await res.text();
    const text = extractArticleText(html);
    if (text.length < 100) {
      console.warn(`[claim] Extracted text too short from ${url} (${text.length} chars)`);
      return null;
    }
    return { url, label: getSourceLabel(url), text };
  } catch (err) {
    console.warn(`[claim] Failed to fetch ${url}:`, err);
    return null;
  }
}

async function generateAiDraft(
  headline: string,
  sourceUrls: SourceInfo[],
  suggestedAngles: string[]
): Promise<{ headline: string; subHeadline: string; bodyHtml: string } | null> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    console.error('[claim] No ANTHROPIC_API_KEY set');
    return null;
  }

  try {
    // Fetch up to 3 source articles in parallel
    const urlsToFetch = sourceUrls.slice(0, 3).map(s => s.url);
    console.log(`[claim] Fetching ${urlsToFetch.length} source(s): ${urlsToFetch.join(', ')}`);
    const fetchResults = await Promise.all(urlsToFetch.map(fetchSourceContent));
    const fetched = fetchResults.filter((r): r is NonNullable<typeof r> => r !== null);

    if (fetched.length === 0) {
      console.error('[claim] All source fetches failed');
      return null;
    }

    // Build combined source content with labels
    const sourceContentBlocks = fetched.map((s, i) =>
      `--- SOURCE ${i + 1}: ${s.label} (${s.url}) ---\n${s.text.substring(0, Math.floor(12000 / fetched.length))}`
    ).join('\n\n');

    // Build source citation instructions
    const sourceLabels = fetched.map(s => `"${s.label}" (${s.url})`);
    const sourceCitationInstruction = fetched.length === 1
      ? `5. SOURCE CITATION (MANDATORY — YOUR ARTICLE WILL BE REJECTED WITHOUT THIS): You MUST cite the source publication in the article body within the FIRST or SECOND paragraph. The source is: ${sourceLabels[0]}
   - Use natural attribution like "according to ${fetched[0].label}" or "as first reported by ${fetched[0].label}"
   - If the source is a social media post (x.com, twitter.com), cite it as "[Account Name] reported on X"
   - This is NON-NEGOTIABLE. Articles without source citations are automatically rejected.`
      : `5. SOURCE CITATIONS (MANDATORY — YOUR ARTICLE WILL BE REJECTED WITHOUT THESE): You MUST cite ALL ${fetched.length} sources naturally throughout the article body. The more sources cited, the better and more credible the article.
   Sources to cite:
${sourceLabels.map((s, i) => `   ${i + 1}. ${s}`).join('\n')}
   - Cite the PRIMARY source in the FIRST or SECOND paragraph using natural attribution ("according to...", "as reported by...")
   - Cite ADDITIONAL sources in LATER paragraphs to add depth and corroboration ("${fetched.length >= 2 ? fetched[1].label : ''} also reported...", "corroborating the story, ${fetched.length >= 2 ? fetched[1].label : ''} noted...")
   - If a source is a social media post (x.com, twitter.com), cite as "[Account Name] reported on X"
   - Every source MUST be cited at least once. Articles missing ANY source citation are automatically rejected.
   - Multiple sources make the article MORE credible — weave them in naturally.`;

    const anglesContext =
      suggestedAngles.length > 0
        ? `\n\nSUGGESTED ANGLES (use one of these as your primary angle if appropriate):\n${suggestedAngles.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
        : '';

    console.log(`[claim] Calling Anthropic API with ${fetched.length} source(s)...`);
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
            content: `You are a senior editorial writer for a news outlet. Rewrite the following article in your own words, synthesizing information from ${fetched.length > 1 ? 'multiple sources' : 'the source'} provided.

EDITORIAL STANCE:
- Write with a confident, direct, America-first editorial perspective
- Use assertive, engaging language that captures reader attention

REQUIREMENTS:
1. Write a compelling, clickable HEADLINE — bold, direct, assertive.
2. Write a punchy SUB-HEADLINE that adds context and urgency.
3. Rewrite the body in 4 to 5 paragraphs:
   - Direct and conversational tone
   - Confident and assertive — take a clear conservative angle
   - Punchy short sentences mixed with longer explanatory ones
   - Lead with the most impactful facts
   - End with a forward-looking statement
${fetched.length > 1 ? '   - Synthesize facts and details from ALL sources — use unique details from each source to create a richer, more comprehensive article' : ''}
4. Format body in clean HTML with <p> tags. Do NOT use <strong>, <b>, or any bold formatting. Do NOT use em dashes (—). Just plain text in paragraphs. No <h1>/<h2> tags.
${sourceCitationInstruction}
${anglesContext}

RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, no backticks, just raw JSON):
{
  "headline": "Your headline here",
  "subHeadline": "Your sub-headline here",
  "bodyHtml": "<p>First paragraph...</p><p>Second paragraph...</p>"
}

ORIGINAL HEADLINE: ${headline}

${sourceContentBlocks}`,
          },
          {
            role: 'assistant',
            content: '{',
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

    // Prepend '{' since we used assistant prefill
    const fullJson = '{' + aiText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // Detect AI refusals (doesn't look like JSON)
    if (!fullJson.startsWith('{"')) {
      console.error(`[claim] AI refused or returned non-JSON: "${fullJson.slice(0, 100)}..."`);
      return null;
    }

    const parsed = JSON.parse(fullJson);

    if (!parsed.headline || !parsed.bodyHtml) {
      console.error('[claim] AI response missing headline or bodyHtml');
      return null;
    }

    // Validate source citations — check each fetched source is cited
    const bodyLower = parsed.bodyHtml.toLowerCase();
    const missingCitations: typeof fetched = [];
    for (const source of fetched) {
      const host = new URL(source.url).hostname.replace(/^www\./, '');
      const isX = host === 'x.com' || host === 'twitter.com';
      const nameToCheck = isX
        ? new URL(source.url).pathname.split('/')[1]?.toLowerCase()
        : host.replace(/\.com$|\.org$|\.net$/, '').toLowerCase();
      const hasCitation = bodyLower.includes(nameToCheck) ||
        bodyLower.includes(source.label.toLowerCase());
      if (!hasCitation) {
        missingCitations.push(source);
      }
    }

    if (missingCitations.length > 0) {
      console.warn(`[claim] AI draft missing citations for: ${missingCitations.map(s => s.label).join(', ')} — injecting`);
      const injections = missingCitations.map(s =>
        `<p>The story was also covered by ${s.label}.</p>`
      ).join('');
      parsed.bodyHtml = parsed.bodyHtml + injections;
    }

    console.log(`[claim] AI draft generated with ${fetched.length} source(s): "${parsed.headline.slice(0, 60)}..."`);
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

// ---------------------------------------------------------------------------
// Auto-create exemplar from claimed story (fire-and-forget training signal)
// ---------------------------------------------------------------------------

async function createExemplarFromClaim(
  sourceUrl: string,
  headline: string,
  articleText: string,
  userId: string,
) {
  try {
    // Check for duplicate
    const existing = await prisma.articleExemplar.findUnique({
      where: { url: sourceUrl },
    });
    if (existing) return;

    const source = new URL(sourceUrl).hostname.replace(/^www\./, '');
    const wordCount = articleText.split(/\s+/).length;

    // Create record
    const exemplar = await prisma.articleExemplar.create({
      data: {
        url: sourceUrl,
        title: headline,
        source,
        status: 'PENDING',
        rawContent: articleText,
        wordCount,
        submittedById: userId,
        notes: 'Auto-created from Story Intelligence claim',
      },
    });

    // Quick preview
    const preview = await generateQuickPreview(headline, articleText);
    await prisma.articleExemplar.update({
      where: { id: exemplar.id },
      data: {
        category: preview.category,
        detectedTopics: preview.topics,
        quickSummary: preview.quickSummary,
        status: 'PREVIEW_READY',
      },
    });

    // Deep fingerprint
    const fingerprint = await generateDeepFingerprint(headline, articleText, source);
    await prisma.articleExemplar.update({
      where: { id: exemplar.id },
      data: {
        fingerprint: fingerprint as object,
        status: 'ANALYZED',
        analyzedAt: new Date(),
      },
    });

    // Boost TopicProfile weights
    for (const category of fingerprint.similarToCategories) {
      const profile = await prisma.topicProfile.findUnique({ where: { category } });
      if (!profile) continue;

      const weights = (profile.keywordWeights as Record<string, number>) ?? {};
      for (const [keyword, delta] of Object.entries(fingerprint.keywords)) {
        const current = weights[keyword] ?? 1.0;
        const isNew = !(keyword in weights);
        const boost = isNew ? 1.5 : current + delta * 0.5;
        weights[keyword] = Math.min(10, Math.max(0.5, boost));
      }

      await prisma.topicProfile.update({
        where: { category },
        data: { keywordWeights: weights, lastUpdated: new Date() },
      });
    }

    console.log(`[claim] Auto-exemplar created and analyzed: ${exemplar.id}`);
  } catch (err) {
    console.error('[claim] Auto-exemplar failed (non-blocking):', err);
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
    include: {
      verificationSources: {
        where: { corroborates: true },
        take: 3,
      },
    },
  });

  if (!story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 });
  }

  if (story.claimedById) {
    return NextResponse.json({ error: 'Story already claimed' }, { status: 409 });
  }

  // Collect up to 3 unique source URLs for multi-source article generation
  const sourceUrls: SourceInfo[] = [];
  const seenUrls = new Set<string>();

  // Primary source first
  seenUrls.add(story.sourceUrl);
  sourceUrls.push({ name: getSourceLabel(story.sourceUrl), url: story.sourceUrl });

  // Add from story.sources JSON array
  const storySources = Array.isArray(story.sources) ? story.sources as Array<{ name: string; url: string }> : [];
  for (const s of storySources) {
    if (sourceUrls.length >= 3) break;
    if (s.url && !seenUrls.has(s.url)) {
      seenUrls.add(s.url);
      sourceUrls.push({ name: s.name || getSourceLabel(s.url), url: s.url });
    }
  }

  // Add corroborating verification sources
  for (const vs of story.verificationSources) {
    if (sourceUrls.length >= 3) break;
    if (vs.sourceUrl && !seenUrls.has(vs.sourceUrl)) {
      seenUrls.add(vs.sourceUrl);
      sourceUrls.push({ name: vs.sourceName || getSourceLabel(vs.sourceUrl), url: vs.sourceUrl });
    }
  }

  console.log(`[claim] Collected ${sourceUrls.length} source(s) for story: ${story.headline.slice(0, 60)}`);

  // Try to generate an AI draft from the source URL(s)
  const suggestedAngles =
    story.suggestedAngles && Array.isArray(story.suggestedAngles)
      ? story.suggestedAngles.map(String)
      : [];

  let aiDraft = await generateAiDraft(story.headline, sourceUrls, suggestedAngles);

  // Retry once on failure (AI refusals are transient — different sampling can succeed)
  if (!aiDraft?.bodyHtml) {
    console.log('[claim] First attempt failed, retrying...');
    aiDraft = await generateAiDraft(story.headline, sourceUrls, suggestedAngles);
  }

  if (!aiDraft?.bodyHtml) {
    return NextResponse.json(
      { error: 'Could not generate article. The AI may have refused this topic. Try again or write manually.' },
      { status: 422 }
    );
  }

  const headline = aiDraft.headline || story.headline;
  const subHeadline = aiDraft.subHeadline || '';
  const body = aiDraft.bodyHtml;

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
      dismissed: true,
    },
  });

  // Fire-and-forget: create exemplar from claimed story to train the algorithm
  // Claiming = positive signal that this topic fits our audience
  void (async () => {
    try {
      const res = await fetch(story.sourceUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsRoom/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();
      const text = extractArticleText(html);
      if (text.length >= 100) {
        await createExemplarFromClaim(story.sourceUrl, story.headline, text, session.user.id);
      }
    } catch (err) {
      console.error('[claim] Exemplar fetch failed (non-blocking):', err);
    }
  })();

  return NextResponse.json({ success: true, articleId: article.id });
}
