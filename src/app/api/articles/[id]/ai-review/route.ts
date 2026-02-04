import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface AIFinding {
  type: 'grammar' | 'fact' | 'style';
  severity: 'error' | 'warning' | 'suggestion';
  text: string;
  suggestion: string;
  explanation?: string;
}

const REVIEW_PROMPT = `You are an experienced newsroom editor reviewing an article before publication. Analyze the article and identify any issues in these categories:

GRAMMAR (severity: "error")
- Spelling mistakes
- Grammatical errors
- Punctuation issues
- Incorrect word usage (their/they're/there, etc.)

FACTS (severity: "warning")
- Statistical claims without sources
- Assertions that need verification
- Potentially misleading statements
- Vague attributions ("sources say", "experts believe")

STYLE (severity: "suggestion")
- Awkward phrasing that could be clearer
- Very long sentences that hurt readability
- Passive voice overuse
- AP Style violations (numbers, titles, etc.)

Return a JSON array of findings. Each finding should have:
- type: "grammar" | "fact" | "style"
- severity: "error" | "warning" | "suggestion"
- text: the exact problematic text from the article
- suggestion: what to change it to or what action to take
- explanation: brief reason why this is an issue

If the article has no issues, return an empty array: []

IMPORTANT: Only return the JSON array, no other text or markdown. Be thorough but not overly pedantic - focus on issues that would actually affect publication quality.`;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Get the article
    const article = await prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        headline: true,
        subHeadline: true,
        body: true,
        authorId: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Check permission - author or admin/editor
    const isAuthor = article.authorId === session.user.id;
    const isAdminOrEditor = ['ADMIN', 'EDITOR'].includes(session.user.role);
    if (!isAuthor && !isAdminOrEditor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check for API key
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      // Mark as error and return gracefully
      await prisma.article.update({
        where: { id },
        data: {
          aiReviewStatus: 'error',
          aiReviewedAt: new Date(),
        },
      });
      return NextResponse.json({
        status: 'error',
        error: 'AI service is not configured',
      });
    }

    // Mark as pending
    await prisma.article.update({
      where: { id },
      data: {
        aiReviewStatus: 'pending',
      },
    });

    // Prepare article content for review (truncate if too long)
    const maxBodyLength = 10000;
    const bodyText = article.body.length > maxBodyLength
      ? article.body.substring(0, maxBodyLength) + '...[truncated]'
      : article.body;

    const articleContent = `
HEADLINE: ${article.headline}
${article.subHeadline ? `SUBHEADLINE: ${article.subHeadline}` : ''}

ARTICLE BODY:
${bodyText}
`.trim();

    // Call Claude for review using fetch
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `${REVIEW_PROMPT}\n\n---\n\nARTICLE TO REVIEW:\n\n${articleContent}`,
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errData = await anthropicResponse.json().catch(() => ({}));
      console.error('Anthropic API error:', errData);
      await prisma.article.update({
        where: { id },
        data: {
          aiReviewStatus: 'error',
          aiReviewedAt: new Date(),
          aiReviewFindings: [] as unknown as Prisma.InputJsonValue,
        },
      });
      return NextResponse.json({
        status: 'error',
        error: 'AI service error',
      });
    }

    const anthropicData = await anthropicResponse.json();
    const responseText = anthropicData.content?.[0]?.text || '';

    // Parse the response
    let findings: AIFinding[] = [];

    try {
      // Extract JSON from response (handle potential markdown code blocks)
      let jsonStr = responseText.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }
      findings = JSON.parse(jsonStr);

      // Validate findings structure
      if (!Array.isArray(findings)) {
        findings = [];
      }
      findings = findings.filter(f =>
        f.type && f.severity && f.text && f.suggestion
      );
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, responseText);
      // If parsing fails, treat as error
      await prisma.article.update({
        where: { id },
        data: {
          aiReviewStatus: 'error',
          aiReviewedAt: new Date(),
          aiReviewFindings: [] as unknown as Prisma.InputJsonValue,
        },
      });
      return NextResponse.json({
        status: 'error',
        error: 'Failed to parse AI review response',
      });
    }

    // Determine status
    const status = findings.length === 0 ? 'clean' : 'has_issues';

    // Save results
    await prisma.article.update({
      where: { id },
      data: {
        aiReviewStatus: status,
        aiReviewedAt: new Date(),
        aiReviewFindings: findings as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      status,
      reviewedAt: new Date().toISOString(),
      findings,
      findingCounts: {
        grammar: findings.filter(f => f.type === 'grammar').length,
        fact: findings.filter(f => f.type === 'fact').length,
        style: findings.filter(f => f.type === 'style').length,
      },
    });
  } catch (error) {
    console.error('AI Review error:', error);

    // Try to mark as error in DB
    try {
      await prisma.article.update({
        where: { id: params.id },
        data: {
          aiReviewStatus: 'error',
          aiReviewedAt: new Date(),
        },
      });
    } catch {
      // Ignore if this fails
    }

    return NextResponse.json(
      { error: 'AI review failed', status: 'error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch review status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: {
        aiReviewStatus: true,
        aiReviewedAt: true,
        aiReviewFindings: true,
        authorId: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Check permission
    const isAuthor = article.authorId === session.user.id;
    const isAdminOrEditor = ['ADMIN', 'EDITOR'].includes(session.user.role);
    if (!isAuthor && !isAdminOrEditor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const findings = (article.aiReviewFindings as unknown as AIFinding[]) || [];

    return NextResponse.json({
      status: article.aiReviewStatus,
      reviewedAt: article.aiReviewedAt,
      findings,
      findingCounts: {
        grammar: findings.filter(f => f.type === 'grammar').length,
        fact: findings.filter(f => f.type === 'fact').length,
        style: findings.filter(f => f.type === 'style').length,
      },
    });
  } catch (error) {
    console.error('Get AI review error:', error);
    return NextResponse.json(
      { error: 'Failed to get review status' },
      { status: 500 }
    );
  }
}
