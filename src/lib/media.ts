import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import prisma from './prisma';
import { createId } from '@paralleldrive/cuid2';

const STORAGE_PATH = process.env.MEDIA_STORAGE_PATH || './uploads/media';
const BASE_URL = process.env.MEDIA_BASE_URL || '/api/media';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const OPTIMIZE_MAX_WIDTH = 2000;
const OPTIMIZE_QUALITY = 85;

interface SaveMediaResult {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  format: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  url: string;
}

export async function saveMedia(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  options?: {
    credit?: string;
    photographer?: string;
    source?: string;
    altText?: string;
    uploadedById?: string;
  }
): Promise<SaveMediaResult> {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Invalid mime type: ${mimeType}`);
  }
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${buffer.length} bytes`);
  }

  // Determine output format and optimize
  const isSvg = mimeType === 'image/svg+xml';
  let outputBuffer = buffer;
  let width: number | null = null;
  let height: number | null = null;
  let format = mimeType.split('/')[1];
  let outputMime = mimeType;

  if (!isSvg) {
    const metadata = await sharp(buffer).metadata();
    width = metadata.width || null;
    height = metadata.height || null;

    // Optimize: resize if too wide, convert to webp (except gif)
    const isGif = mimeType === 'image/gif';
    let sharpInstance = sharp(buffer, isGif ? { animated: true } : undefined);

    if (width && width > OPTIMIZE_MAX_WIDTH) {
      sharpInstance = sharpInstance.resize(OPTIMIZE_MAX_WIDTH, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }

    if (!isGif) {
      outputBuffer = await sharpInstance.webp({ quality: OPTIMIZE_QUALITY, effort: 4 }).toBuffer();
      format = 'webp';
      outputMime = 'image/webp';
    } else {
      outputBuffer = await sharpInstance.toBuffer();
    }

    // Get final dimensions
    const finalMeta = await sharp(outputBuffer).metadata();
    width = finalMeta.width || width;
    height = finalMeta.height || height;
  }

  // Build storage path: YYYY/MM/
  const now = new Date();
  const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dirPath = path.join(STORAGE_PATH, yearMonth);
  await fs.mkdir(dirPath, { recursive: true });

  // Generate unique filename
  const id = createId();
  const ext = format === 'svg+xml' ? 'svg' : format;
  const filename = `${id}.${ext}`;
  const filePath = path.join(dirPath, filename);

  await fs.writeFile(filePath, outputBuffer);

  // Store relative path from STORAGE_PATH root for DB
  const storedFilename = `${yearMonth}/${filename}`;

  const media = await prisma.media.create({
    data: {
      filename: storedFilename,
      originalName,
      mimeType: outputMime,
      format: ext,
      fileSize: outputBuffer.length,
      width,
      height,
      credit: options?.credit || null,
      photographer: options?.photographer || null,
      source: options?.source || null,
      altText: options?.altText || null,
      uploadedById: options?.uploadedById || null,
    },
  });

  return {
    id: media.id,
    filename: media.filename,
    originalName: media.originalName,
    mimeType: media.mimeType,
    format: media.format,
    fileSize: media.fileSize,
    width: media.width,
    height: media.height,
    url: getMediaUrl(media),
  };
}

export function getMediaUrl(media: { filename: string }): string {
  return `${BASE_URL}/${media.filename}`;
}

export function getMediaFilePath(filename: string): string {
  return path.join(STORAGE_PATH, filename);
}

export async function searchMedia({
  query,
  tags,
  page = 1,
  limit = 30,
}: {
  query?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}) {
  const where: any = {};

  if (query) {
    where.OR = [
      { originalName: { contains: query, mode: 'insensitive' } },
      { credit: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
    ];
  }

  if (tags && tags.length > 0) {
    where.tags = { hasSome: tags };
  }

  const [items, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.media.count({ where }),
  ]);

  return {
    items: items.map((m) => ({
      ...m,
      url: getMediaUrl(m),
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function getMediaById(id: string) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return null;
  return { ...media, url: getMediaUrl(media) };
}

export async function updateMedia(
  id: string,
  data: {
    credit?: string | null;
    photographer?: string | null;
    source?: string | null;
    licenseType?: string | null;
    altText?: string | null;
    description?: string | null;
    tags?: string[];
  }
) {
  const media = await prisma.media.update({
    where: { id },
    data,
  });
  return { ...media, url: getMediaUrl(media) };
}

export async function deleteMedia(id: string) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) throw new Error('Media not found');

  // Delete file from disk
  const filePath = path.join(STORAGE_PATH, media.filename);
  await fs.unlink(filePath).catch(() => {
    console.warn(`[Media] File not found on disk: ${filePath}`);
  });

  await prisma.media.delete({ where: { id } });
}

export async function incrementUsageCount(id: string) {
  await prisma.media.update({
    where: { id },
    data: { usageCount: { increment: 1 } },
  });
}

export async function decrementUsageCount(id: string) {
  await prisma.media.update({
    where: { id },
    data: { usageCount: { decrement: 1 } },
  });
}
