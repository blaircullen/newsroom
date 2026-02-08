import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Strip HTML tags from a string and decode HTML entities
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

// GET /api/social/voice-profiles - List all voice profiles (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const voiceProfiles = await prisma.siteVoiceProfile.findMany({
      include: {
        publishTarget: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(voiceProfiles);
  } catch (error) {
    console.error('[API] Error fetching voice profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voice profiles' },
      { status: 500 }
    );
  }
}

// POST /api/social/voice-profiles - Generate a new voice profile (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: 'AI service is not configured. Please set the ANTHROPIC_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { publishTargetId, articleIds, rawText, voiceDescription, systemPrompt, customNotes } = body as {
      publishTargetId: string;
      articleIds?: string[];
      rawText?: string;
      voiceDescription?: string;
      systemPrompt?: string;
      customNotes?: string | null;
    };

    // Validate publishTargetId
    if (typeof publishTargetId !== 'string' || !/^c[a-z0-9]{24}$/i.test(publishTargetId)) {
      return NextResponse.json({ error: 'Invalid publish target ID format' }, { status: 400 });
    }

    // Verify publish target exists
    const publishTarget = await prisma.publishTarget.findUnique({
      where: { id: publishTargetId },
    });

    if (!publishTarget) {
      return NextResponse.json({ error: 'Publish target not found' }, { status: 404 });
    }

    // If voiceDescription and systemPrompt are provided directly, save without regenerating
    if (typeof voiceDescription === 'string' && voiceDescription.trim() && typeof systemPrompt === 'string' && systemPrompt.trim()) {
      const voiceProfile = await prisma.siteVoiceProfile.upsert({
        where: { publishTargetId },
        update: {
          voiceDescription: voiceDescription.trim(),
          systemPrompt: systemPrompt.trim(),
          customNotes: customNotes || null,
          updatedAt: new Date(),
        },
        create: {
          publishTargetId,
          voiceDescription: voiceDescription.trim(),
          systemPrompt: systemPrompt.trim(),
          customNotes: customNotes || null,
          sampleArticleIds: [],
        },
        include: {
          publishTarget: {
            select: { id: true, name: true, url: true },
          },
        },
      });
      return NextResponse.json(voiceProfile, { status: 201 });
    }

    // Must provide either rawText or articleIds for generation
    const useRawText = typeof rawText === 'string' && rawText.trim().length >= 200;
    const useArticles = Array.isArray(articleIds) && articleIds.length >= 5 && articleIds.length <= 10;

    if (!useRawText && !useArticles) {
      return NextResponse.json(
        { error: 'Provide either rawText (200+ chars) or 5-10 articleIds' },
        { status: 400 }
      );
    }

    let sampleContent: string;
    let sampleIds: string[] | string = [];

    if (useRawText) {
      // Use pasted text directly
      sampleContent = rawText!.trim().substring(0, 15000);
      sampleIds = 'raw_text';
    } else {
      // Validate all IDs are strings
      if (!articleIds!.every((id) => typeof id === 'string')) {
        return NextResponse.json({ error: 'All article IDs must be strings' }, { status: 400 });
      }

      // Fetch articles
      const articles = await prisma.article.findMany({
        where: { id: { in: articleIds! } },
        select: { id: true, headline: true, bodyHtml: true, body: true },
      });

      if (articles.length < articleIds!.length) {
        return NextResponse.json({ error: 'One or more articles not found' }, { status: 404 });
      }

      sampleContent = articles.map((article, index) => {
        const bodyText = article.bodyHtml ? stripHtml(article.bodyHtml) : article.body;
        const truncated = bodyText.substring(0, 1500);
        return `[Article ${index + 1} title]\n${article.headline}\n\n${truncated}`;
      }).join('\n\n---\n\n');

      sampleIds = articleIds!;
    }

    const prompt = `Analyze the following text samples and describe the author's voice, tone, and style in 2-3 sentences. Focus on: formality level, humor style, political lean/framing, sentence structure preferences, and recurring rhetorical devices.

Then write a system prompt that would make an AI write social media captions in this exact voice. The system prompt should be specific and actionable, not vague.

Text samples:

${sampleContent}

Respond in this exact JSON format (no markdown fences):
{
  "voiceDescription": "2-3 sentence description of the voice",
  "systemPrompt": "The system prompt for AI caption generation"
}`;

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Anthropic API error:', errData);
      return NextResponse.json(
        { error: 'AI service error. Please try again.' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;

    if (!text) {
      return NextResponse.json(
        { error: 'AI returned an empty response. Please try again.' },
        { status: 502 }
      );
    }

    // Parse the AI response
    let parsed;
    try {
      // Clean up potential markdown fences
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse AI response:', text.substring(0, 500));
      return NextResponse.json(
        { error: 'AI response was not in the expected format. Please try again.' },
        { status: 502 }
      );
    }

    // Validate the parsed response
    if (!parsed.voiceDescription || !parsed.systemPrompt) {
      return NextResponse.json(
        { error: 'AI response was incomplete. Please try again.' },
        { status: 502 }
      );
    }

    // Upsert the voice profile
    const voiceProfile = await prisma.siteVoiceProfile.upsert({
      where: { publishTargetId },
      update: {
        voiceDescription: parsed.voiceDescription,
        systemPrompt: parsed.systemPrompt,
        sampleArticleIds: sampleIds,
        updatedAt: new Date(),
      },
      create: {
        publishTargetId,
        voiceDescription: parsed.voiceDescription,
        systemPrompt: parsed.systemPrompt,
        sampleArticleIds: sampleIds,
      },
      include: {
        publishTarget: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
    });

    return NextResponse.json(voiceProfile, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating voice profile:', error);
    return NextResponse.json(
      { error: 'Failed to create voice profile' },
      { status: 500 }
    );
  }
}
