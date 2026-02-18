import { NextRequest, NextResponse } from 'next/server';
import { timingSafeCompare } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { scrapeStoryIdeas } from '@/lib/cfp-scraper';
import { scrapeReddit } from '@/lib/reddit-scraper';
import { scrapeGoogleTrends } from '@/lib/google-trends-scraper';
import { scoreStory, type StoryScoreInput } from '@/lib/story-scorer';
import { searchTweetsByKeywords } from '@/lib/x-scraper';
import { monitorXAccounts } from '@/lib/x-monitor';

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.TRENDING_API_KEY;

  if (!timingSafeCompare(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all sources in parallel
    const [storyIdeas, redditPosts, googleTrends, xMonitoredStories] = await Promise.all([
      scrapeStoryIdeas(),
      scrapeReddit(),
      scrapeGoogleTrends(),
      monitorXAccounts().catch((err) => {
        console.error('[ingest] X monitoring failed (non-fatal):', err);
        return [] as Awaited<ReturnType<typeof monitorXAccounts>>;
      }),
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

      let xSignals = null;
      try {
        const keywords = idea.headline
          .toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 3)
          .slice(0, 5);
        if (keywords.length >= 2) {
          xSignals = await searchTweetsByKeywords(keywords);
        }
      } catch {}

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
          platformSignals: xSignals ? { x: { tweetVolume: xSignals.tweetVolume, heat: xSignals.heat, velocity: xSignals.velocity } } : undefined,
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

      let xSignals = null;
      try {
        const keywords = post.title
          .toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 3)
          .slice(0, 5);
        if (keywords.length >= 2) {
          xSignals = await searchTweetsByKeywords(keywords);
        }
      } catch {}

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
            reddit: { score: post.score, velocity: post.velocity, numComments: post.numComments, subreddit: post.subreddit, ageMinutes: post.ageMinutes, redditUrl: post.redditUrl },
            ...(xSignals ? { x: { tweetVolume: xSignals.tweetVolume, heat: xSignals.heat, velocity: xSignals.velocity } } : {}),
          },
        },
      });

      created++;
    }

    // ── Process X-monitored stories ─────────────────────────────────────────
    for (const xStory of xMonitoredStories) {
      const existing = await prisma.storyIntelligence.findFirst({
        where: { sourceUrl: xStory.sourceUrl },
        select: { id: true },
      });
      if (existing) continue;

      const input: StoryScoreInput = {
        headline: xStory.headline,
        sourceUrl: xStory.sourceUrl,
        sources: xStory.sources,
        platformSignals: xStory.platformSignals,
      };

      const scored = await scoreStory(input);

      await prisma.storyIntelligence.create({
        data: {
          headline: xStory.headline,
          sourceUrl: xStory.sourceUrl,
          sources: xStory.sources,
          category: scored.matchedCategory ?? undefined,
          topicClusterId: scored.topicClusterId ?? undefined,
          relevanceScore: scored.relevanceScore,
          velocityScore: scored.velocityScore,
          alertLevel: scored.alertLevel,
          verificationStatus: 'UNVERIFIED',
          platformSignals: xStory.platformSignals,
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
        xMonitored: xMonitoredStories.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[story-intelligence/ingest] Error:', message);
    return NextResponse.json({ error: 'Ingest failed', detail: message }, { status: 500 });
  }
}
