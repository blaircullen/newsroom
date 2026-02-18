import fs from 'fs/promises';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';
import prisma from './prisma';
import { getMediaFilePath } from './media';

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const VISION_MODEL = 'claude-haiku-4-5-20251001';
const MAX_DIMENSION = 1024;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

interface VisionResult {
  people: string[];
  topics: string[];
  objects: string[];
  description: string;
}

const SYSTEM_PROMPT = `You are an image analysis assistant for a newsroom. Analyze images and respond only with valid JSON — no markdown, no explanation outside the JSON object.`;

const USER_PROMPT = `Analyze this newsroom image and return a JSON object with exactly these fields:

{
  "people": ["Full Name", ...],
  "topics": ["topic", ...],
  "objects": ["object or scene", ...],
  "description": "One-sentence summary of the image."
}

Guidelines:
- people: Recognizable public figures only (politicians, celebrities, athletes). Use full names as commonly known. Empty array if none identified.
- topics: Subject categories relevant to news coverage (e.g. politics, sports, healthcare, economy, military, crime, immigration). Lowercase.
- objects: Notable visual elements such as podium, flag, courtroom, crowd, press conference, rally, oval office, stadium. Lowercase.
- description: A single concise sentence describing what is happening in the image.

Respond only with the JSON object.`;

export async function analyzeImage(mediaId: string): Promise<void> {
  // Step 1: Mark as analyzing
  await prisma.media.update({
    where: { id: mediaId },
    data: { aiStatus: 'analyzing' },
  });

  try {
    // Step 2: Fetch media record to get filename and mimeType
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      select: { filename: true, mimeType: true },
    });

    if (!media) {
      throw new Error(`Media record not found: ${mediaId}`);
    }

    // Skip SVGs — not suitable for vision analysis
    if (media.mimeType === 'image/svg+xml') {
      throw new Error(`SVG images are not supported for AI analysis: ${mediaId}`);
    }

    // Step 3: Read the image from disk
    const filePath = getMediaFilePath(media.filename);
    const rawBuffer = await fs.readFile(filePath);

    // Step 4: Resize/convert for the API (max 1024px, max 5MB, output JPEG)
    const sharpInstance = sharp(rawBuffer);
    const metadata = await sharpInstance.metadata();

    const needsResize =
      (metadata.width && metadata.width > MAX_DIMENSION) ||
      (metadata.height && metadata.height > MAX_DIMENSION);

    let pipeline = sharp(rawBuffer);

    if (needsResize) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const jpegBuffer = await pipeline.jpeg({ quality: 85 }).toBuffer();

    // If still over 5MB after resize+compress, reduce quality further
    let finalBuffer = jpegBuffer;
    if (jpegBuffer.length > MAX_BYTES) {
      finalBuffer = await sharp(rawBuffer)
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 60 })
        .toBuffer();
    }

    const base64Image = finalBuffer.toString('base64');

    // Step 5: Send to Claude Haiku Vision
    const response = await anthropic.messages.create({
      model: VISION_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: USER_PROMPT,
            },
          ],
        },
      ],
    });

    // Step 6: Parse the JSON response
    const rawText =
      response.content[0].type === 'text' ? response.content[0].text : '';

    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    const parsed: VisionResult = JSON.parse(jsonText);

    const people: string[] = Array.isArray(parsed.people) ? parsed.people : [];
    const topics: string[] = Array.isArray(parsed.topics)
      ? parsed.topics.map((t) => t.toLowerCase())
      : [];
    const objects: string[] = Array.isArray(parsed.objects)
      ? parsed.objects.map((o) => o.toLowerCase())
      : [];
    const description: string =
      typeof parsed.description === 'string' ? parsed.description : '';

    // Step 7: Merge all arrays into a single tags array
    // People keep their original casing; topics and objects are already lowercased
    const tags = [...people, ...topics, ...objects];

    // Step 8: Persist results
    await prisma.media.update({
      where: { id: mediaId },
      data: {
        tags,
        description,
        aiStatus: 'complete',
      },
    });
  } catch (error) {
    console.error(`[imageAnalysis] Failed to analyze media ${mediaId}:`, error);

    await prisma.media.update({
      where: { id: mediaId },
      data: { aiStatus: 'failed' },
    });
  }
}
