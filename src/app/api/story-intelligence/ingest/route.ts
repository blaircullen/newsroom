import { NextRequest, NextResponse } from 'next/server';
import { timingSafeCompare } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { scrapeStoryIdeas } from '@/lib/cfp-scraper';
import { scrapeReddit } from '@/lib/reddit-scraper';
import { scrapeGoogleTrends } from '@/lib/google-trends-scraper';
import { scoreStory, type StoryScoreInput } from '@/lib/story-scorer';

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.TRENDING_API_KEY;

  if (!timingSafeCompare(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all sources in parallel
    const [storyIdeas, redditPosts, googleTrends] = await Promise.all([
      scrapeStoryIdeas(),
      scrapeReddit(),
      scrapeGoogleTrends(),
    ]);

    let created = 0;
    let updated = 0;

    // ── Process RSS/CFP stories ───────────────────────────────────────────────
    for (const idea of storyIdeas) {
      // Skip if already ingested
      const existing = await prisma.storyIntelligence.findFirst({
        where: { sourceUrl: idea.sourceUrl },
        select: { id: true },
      });
      if (existing) continue;

      const sources: Array<{ name: string; url: string }> = idea.sources
        ? idea.sources
        : [{ name: idea.source, url: idea.sourceUrl }];

      const input: StoryScoreInput = {
        headline: idea.headline,
        sourceUrl: idea.sourceUrl,
        sources,
      };

      const scored = await scoreStory(input);

      await prisma.storyIntelligence.create({
        data: {
          headline: idea.headline,
          sourceUrl: idea.sourceUrl,
          sources: sources,
          category: scored.matchedCategory ?? undefined,
          topicClusterId: scored.topicClusterId ?? undefined,
          relevanceScore: scored.relevanceScore,
          velocityScore: scored.velocityScore,
          alertLevel: scored.alertLevel,
          verificationStatus: idea.trending ? 'PLAUSIBLE' : 'UNVERIFIED',
        },
      });

      created++;
    }

    // ── Process top Reddit posts ──────────────────────────────────────────────
    const topReddit = redditPosts.slice(0, 15);

    for (const post of topReddit) {
      // Skip if already ingested (match on redditUrl stored in platformSignals)
      const existing = await prisma.storyIntelligence.findFirst({
        where: { sourceUrl: post.redditUrl },
        select: { id: true },
      });
      if (existing) continue;

      const input: StoryScoreInput = {
        headline: post.title,
        sourceUrl: post.redditUrl,
        sources: [{ name: `r/${post.subreddit}`, url: post.redditUrl }],
        platformSignals: {
          reddit: {
            score: post.score,
            velocity: post.velocity,
            numComments: post.numComments,
          },
        },
      };

      const scored = await scoreStory(input);

      await prisma.storyIntelligence.create({
        data: {
          headline: post.title,
          sourceUrl: post.redditUrl,
          sources: [{ name: `r/${post.subreddit}`, url: post.redditUrl }],
          category: scored.matchedCategory ?? undefined,
          topicClusterId: scored.topicClusterId ?? undefined,
          relevanceScore: scored.relevanceScore,
          velocityScore: scored.velocityScore,
          alertLevel: scored.alertLevel,
          verificationStatus: 'UNVERIFIED',
          platformSignals: {
            reddit: {
              score: post.score,
              velocity: post.velocity,
              numComments: post.numComments,
              subreddit: post.subreddit,
              ageMinutes: post.ageMinutes,
              redditUrl: post.redditUrl,
            },
          },
        },
      });

      created++;
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      sources: {
        rss: storyIdeas.length,
        reddit: topReddit.length,
        googleTrends: googleTrends.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[story-intelligence/ingest] Error:', message);
    return NextResponse.json({ error: 'Ingest failed', detail: message }, { status: 500 });
  }
}
