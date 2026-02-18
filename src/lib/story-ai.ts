import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoryInput {
  id: string;
  headline: string;
  sources: unknown;
  relevanceScore: number;
  velocityScore: number;
  category: string | null;
  platformSignals: unknown;
}

interface TopicProfileData {
  category: string;
  keywordWeights: unknown;
  topPerformers: unknown;
}

interface FeedbackContext {
  highPerformerHeadlines: string[];
  negativeTags: string[];
}

interface AIResult {
  suggestedAngles: string[];
  verificationStatus: string;
  verificationNotes: string;
}

// ---------------------------------------------------------------------------
// processStoryWithAI
// ---------------------------------------------------------------------------

export async function processStoryWithAI(
  story: StoryInput,
  profiles: TopicProfileData[],
  feedbackContext: FeedbackContext,
  useDeepVerification: boolean,
): Promise<AIResult> {
  const model = useDeepVerification
    ? 'claude-sonnet-4-6-20250514'
    : 'claude-haiku-4-5-20251001';

  // Find relevant topic profile for this story's category
  const relevantProfile = story.category
    ? profiles.find((p) => p.category === story.category)
    : null;

  const systemPrompt = `You are an editorial intelligence assistant for a conservative news operation. Your role is to evaluate breaking stories and suggest story angles that align with our audience's values: limited government, free markets, national security, rule of law, and traditional American values.

Be conservative in your verification assessments — only mark something as VERIFIED if there is strong multi-source corroboration. Default to PLAUSIBLE for credible single-source stories and UNVERIFIED when sources are unclear.

Respond only with valid JSON. No markdown, no explanation outside the JSON object.`;

  const topicContext = relevantProfile
    ? `\nTopic profile (${relevantProfile.category}): keyword weights = ${JSON.stringify(relevantProfile.keywordWeights)}`
    : '';

  const highPerformerSection =
    feedbackContext.highPerformerHeadlines.length > 0
      ? `\nHigh-performing headlines (use as angle inspiration):\n${feedbackContext.highPerformerHeadlines.map((h) => `- ${h}`).join('\n')}`
      : '';

  const negativeTagSection =
    feedbackContext.negativeTags.length > 0
      ? `\nAvoid angles associated with these underperforming tags: ${feedbackContext.negativeTags.join(', ')}`
      : '';

  const deepVerificationInstruction = useDeepVerification
    ? '\n\nThis story has a high combined relevance+velocity score. Apply rigorous cross-referencing: consider whether sources corroborate each other, whether the story fits established patterns, and flag any inconsistencies in verificationNotes.'
    : '';

  const userPrompt = `Evaluate this story and suggest editorial angles.

Headline: ${story.headline}
Sources: ${JSON.stringify(story.sources)}
Relevance Score: ${story.relevanceScore}
Category: ${story.category ?? 'uncategorized'}${topicContext}${highPerformerSection}${negativeTagSection}${deepVerificationInstruction}

Respond with JSON:
{
  "suggestedAngles": ["angle 1", "angle 2", "angle 3"],
  "verificationStatus": "UNVERIFIED" | "PLAUSIBLE" | "VERIFIED" | "DISPUTED" | "FLAGGED",
  "verificationNotes": "brief explanation of verification assessment"
}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const rawText =
    response.content[0].type === 'text' ? response.content[0].text : '';

  // Strip markdown code blocks if present
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const parsed = JSON.parse(jsonText);

  return {
    suggestedAngles: Array.isArray(parsed.suggestedAngles)
      ? parsed.suggestedAngles
      : [],
    verificationStatus:
      typeof parsed.verificationStatus === 'string'
        ? parsed.verificationStatus
        : 'UNVERIFIED',
    verificationNotes:
      typeof parsed.verificationNotes === 'string'
        ? parsed.verificationNotes
        : '',
  };
}

// ---------------------------------------------------------------------------
// updateTopicWeights
// ---------------------------------------------------------------------------

export async function updateTopicWeights(): Promise<void> {
  const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Fetch stories with feedback from last 30 days OR high performers
  const stories = await prisma.storyIntelligence.findMany({
    where: {
      OR: [
        {
          feedback: {
            some: {
              createdAt: { gte: cutoff30d },
            },
          },
        },
        { outcome: 'HIGH_PERFORMER' },
      ],
      category: { not: null },
    },
    include: {
      feedback: {
        where: { createdAt: { gte: cutoff30d } },
        select: { rating: true },
      },
    },
  });

  // Fetch all topic profiles
  const profiles = await prisma.topicProfile.findMany();
  const profileMap = new Map(profiles.map((p) => [p.category, p]));

  // Group stories by category and compute weight adjustments
  const categoryAdjustments = new Map<string, Map<string, number>>();

  for (const story of stories) {
    if (!story.category) continue;

    const profile = profileMap.get(story.category);
    if (!profile) continue;

    const weights = (
      typeof profile.keywordWeights === 'object' &&
      profile.keywordWeights !== null
        ? profile.keywordWeights
        : {}
    ) as Record<string, number>;

    if (!categoryAdjustments.has(story.category)) {
      categoryAdjustments.set(story.category, new Map(Object.entries(weights)));
    }

    const adjustmentMap = categoryAdjustments.get(story.category)!;

    // Determine adjustment delta
    let delta = 0;

    if (story.outcome === 'HIGH_PERFORMER') {
      delta = 0.3;
    } else if (story.feedback.length > 0) {
      const avgRating =
        story.feedback.reduce((sum, f) => sum + f.rating, 0) /
        story.feedback.length;
      if (avgRating >= 4) {
        delta = 0.1;
      } else if (avgRating <= 2) {
        delta = -0.1;
      }
    }

    if (delta === 0) continue;

    // Apply delta to all keywords in this category's profile
    for (const keyword of Object.keys(weights)) {
      const current = adjustmentMap.get(keyword) ?? weights[keyword] ?? 1;
      // Clamp between 0.5 and 10
      const updated = Math.min(10, Math.max(0.5, current + delta));
      adjustmentMap.set(keyword, updated);
    }
  }

  // Persist updated weights
  for (const [category, adjustmentMap] of Array.from(categoryAdjustments.entries())) {
    const updatedWeights: Record<string, number> = Object.fromEntries(
      Array.from(adjustmentMap.entries()),
    );

    await prisma.topicProfile.update({
      where: { category },
      data: {
        keywordWeights: updatedWeights,
        lastUpdated: new Date(),
      },
    });
  }

  console.log(
    `[updateTopicWeights] updated ${categoryAdjustments.size} topic profile(s)`,
  );
}
