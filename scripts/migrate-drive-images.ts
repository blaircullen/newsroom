/**
 * Migration script: Google Drive images → Local media storage
 *
 * Downloads all Drive images referenced by articles, optimizes them,
 * saves locally, creates Media records, and updates articles.
 *
 * Run on Hetzner:
 *   docker exec newsroom-app npx tsx scripts/migrate-drive-images.ts
 */

import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

const STORAGE_PATH = process.env.MEDIA_STORAGE_PATH || '/data/media';
const MEDIA_BASE_URL = process.env.MEDIA_BASE_URL || '/media';
const BATCH_SIZE = 5;

// Image optimization settings
const MAX_WIDTH = 2000;
const QUALITY = 85;

function getDrive() {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
  const credentials = JSON.parse(serviceAccountKey);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

async function downloadFromDrive(drive: any, fileId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const [meta, content] = await Promise.all([
      drive.files.get({ fileId, fields: 'mimeType,name', supportsAllDrives: true }),
      drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' }),
    ]);

    return {
      buffer: Buffer.from(content.data as ArrayBuffer),
      mimeType: meta.data.mimeType || 'image/jpeg',
    };
  } catch (error: any) {
    console.error(`  [SKIP] Failed to download ${fileId}: ${error.message}`);
    return null;
  }
}

async function optimizeImage(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; format: string; mimeType: string; width: number | null; height: number | null }> {
  if (mimeType === 'image/svg+xml') {
    return { buffer, format: 'svg', mimeType, width: null, height: null };
  }

  const isGif = mimeType === 'image/gif';
  let sharpInstance = sharp(buffer, isGif ? { animated: true } : undefined);
  const metadata = await sharpInstance.metadata();

  if (metadata.width && metadata.width > MAX_WIDTH) {
    sharpInstance = sharpInstance.resize(MAX_WIDTH, null, { withoutEnlargement: true, fit: 'inside' });
  }

  let outputBuffer: Buffer;
  let format: string;
  let outputMime: string;

  if (isGif) {
    outputBuffer = await sharpInstance.toBuffer();
    format = 'gif';
    outputMime = 'image/gif';
  } else {
    outputBuffer = await sharpInstance.webp({ quality: QUALITY, effort: 4 }).toBuffer();
    format = 'webp';
    outputMime = 'image/webp';
  }

  const finalMeta = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    format,
    mimeType: outputMime,
    width: finalMeta.width || metadata.width || null,
    height: finalMeta.height || metadata.height || null,
  };
}

async function main() {
  console.log('=== Drive → Local Media Migration ===\n');

  // 1. Find all articles with Drive-based featured images
  const articles = await prisma.article.findMany({
    where: {
      featuredImageId: { not: null },
      featuredMediaId: null, // Not yet migrated
    },
    select: {
      id: true,
      headline: true,
      featuredImage: true,
      featuredImageId: true,
      imageCredit: true,
    },
  });

  console.log(`Found ${articles.length} articles with Drive images to migrate\n`);

  if (articles.length === 0) {
    console.log('Nothing to migrate!');
    await prisma.$disconnect();
    return;
  }

  // Also load existing image credits for lookup
  const imageCredits = await prisma.imageCredit.findMany();
  const creditMap = new Map(imageCredits.map((c) => [c.driveFileId, c.credit]));

  const drive = getDrive();
  let migrated = 0;
  let failed = 0;
  let skipped = 0;

  // Build storage directory
  const now = new Date();
  const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dirPath = path.join(STORAGE_PATH, yearMonth);
  await fs.mkdir(dirPath, { recursive: true });

  // Process in batches
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    console.log(`\n--- Batch ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}-${Math.min(i + BATCH_SIZE, articles.length)} of ${articles.length}) ---`);

    await Promise.all(batch.map(async (article) => {
      const driveFileId = article.featuredImageId!;

      // Check if this Drive file was already migrated (by another article using same image)
      const existingMedia = await prisma.media.findUnique({
        where: { driveFileId },
      });

      if (existingMedia) {
        // Just link the article to the existing media record
        console.log(`  [LINK] "${article.headline.substring(0, 50)}..." → existing media ${existingMedia.id}`);
        await prisma.article.update({
          where: { id: article.id },
          data: {
            featuredMediaId: existingMedia.id,
            featuredImage: `${MEDIA_BASE_URL}/${existingMedia.filename}`,
          },
        });
        skipped++;
        return;
      }

      // Download from Drive
      console.log(`  [DL] "${article.headline.substring(0, 50)}..." (${driveFileId})`);
      const image = await downloadFromDrive(drive, driveFileId);
      if (!image) {
        failed++;
        return;
      }

      // Optimize
      const optimized = await optimizeImage(image.buffer, image.mimeType);

      // Save to disk
      const id = createId();
      const ext = optimized.format === 'svg+xml' ? 'svg' : optimized.format;
      const filename = `${id}.${ext}`;
      const storedFilename = `${yearMonth}/${filename}`;
      const filePath = path.join(dirPath, filename);
      await fs.writeFile(filePath, optimized.buffer);

      // Determine credit
      const credit = article.imageCredit || creditMap.get(driveFileId) || null;

      // Create media record
      const media = await prisma.media.create({
        data: {
          filename: storedFilename,
          originalName: `drive-${driveFileId}.${ext}`,
          mimeType: optimized.mimeType,
          format: ext,
          fileSize: optimized.buffer.length,
          width: optimized.width,
          height: optimized.height,
          credit,
          driveFileId,
          usageCount: 1,
        },
      });

      // Update article to point at new media
      await prisma.article.update({
        where: { id: article.id },
        data: {
          featuredMediaId: media.id,
          featuredImage: `${MEDIA_BASE_URL}/${storedFilename}`,
        },
      });

      const sizeKB = Math.round(optimized.buffer.length / 1024);
      console.log(`  [OK] → ${storedFilename} (${sizeKB}KB, ${optimized.width}x${optimized.height})`);
      migrated++;
    }));
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Linked (already migrated): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total articles processed: ${articles.length}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Migration failed:', error);
  prisma.$disconnect();
  process.exit(1);
});
