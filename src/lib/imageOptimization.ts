import sharp from 'sharp';

export interface OptimizeOptions {
  maxWidth?: number;      // Default: 2000
  quality?: number;       // Default: 85 (0-100)
  format?: 'webp' | 'jpeg' | 'original';  // Default: 'webp'
}

export interface OptimizedImage {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

interface ImageData {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

// Default settings
const DEFAULT_MAX_WIDTH = 2000;
const DEFAULT_QUALITY = 85;
const DEFAULT_FORMAT = 'webp';
const MIN_SIZE_THRESHOLD = 50 * 1024; // 50KB - skip optimization for small images

// Content types that should skip optimization
const SKIP_OPTIMIZATION_TYPES = [
  'image/svg+xml',  // SVG is already vector format
];

/**
 * Optimize an image for web delivery
 * - Converts to WebP format (or specified format)
 * - Resizes if exceeds max dimensions
 * - Strips metadata (EXIF, etc.)
 * - Returns optimized buffer with updated contentType
 */
export async function optimizeImage(
  image: ImageData,
  options: OptimizeOptions = {}
): Promise<OptimizedImage> {
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    quality = DEFAULT_QUALITY,
    format = DEFAULT_FORMAT,
  } = options;

  // Skip optimization for SVG and other vector formats
  if (SKIP_OPTIMIZATION_TYPES.includes(image.contentType)) {
    console.log(`[Image Optimize] Skipping optimization for ${image.contentType}`);
    return image;
  }

  // Skip optimization for very small images (under threshold)
  if (image.buffer.length < MIN_SIZE_THRESHOLD) {
    console.log(`[Image Optimize] Skipping optimization for small image (${image.buffer.length} bytes)`);
    return image;
  }

  try {
    const originalSize = image.buffer.length;
    console.log(`[Image Optimize] Processing ${image.contentType} (${originalSize} bytes), target format: ${format}`);

    // Create sharp instance and get metadata
    let sharpInstance = sharp(image.buffer);
    const metadata = await sharpInstance.metadata();

    // Resize if image exceeds max width
    if (metadata.width && metadata.width > maxWidth) {
      console.log(`[Image Optimize] Resizing from ${metadata.width}px to ${maxWidth}px width`);
      sharpInstance = sharpInstance.resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }

    // Strip metadata (EXIF, etc.) for privacy and size reduction
    sharpInstance = sharpInstance.rotate(); // Auto-rotate based on EXIF, then strip

    // Convert to target format
    let outputBuffer: Buffer;
    let outputContentType: string;
    let outputExt: string;

    if (format === 'webp') {
      outputBuffer = await sharpInstance
        .webp({ quality, effort: 4 }) // effort 4 is a good balance of speed vs compression
        .toBuffer();
      outputContentType = 'image/webp';
      outputExt = 'webp';
    } else if (format === 'jpeg') {
      outputBuffer = await sharpInstance
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      outputContentType = 'image/jpeg';
      outputExt = 'jpg';
    } else {
      // Keep original format but still process (resize, strip metadata)
      outputBuffer = await sharpInstance.toBuffer();
      outputContentType = image.contentType;
      outputExt = image.ext;
    }

    const savings = originalSize - outputBuffer.length;
    const savingsPercent = ((savings / originalSize) * 100).toFixed(1);

    console.log(`[Image Optimize] Complete: ${originalSize} -> ${outputBuffer.length} bytes (${savingsPercent}% reduction)`);

    return {
      buffer: outputBuffer,
      contentType: outputContentType,
      ext: outputExt,
    };
  } catch (error) {
    // If optimization fails, return the original image
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Image Optimize] Error, using original image:`, message);
    return image;
  }
}

/**
 * Check if an image is a GIF (which may need special handling for animations)
 */
export function isAnimatedFormat(contentType: string): boolean {
  return contentType === 'image/gif';
}

/**
 * Optimize a GIF - converts to animated WebP if possible
 * Note: Sharp supports animated WebP output
 */
export async function optimizeGif(
  image: ImageData,
  options: OptimizeOptions = {}
): Promise<OptimizedImage> {
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    quality = DEFAULT_QUALITY,
    format = DEFAULT_FORMAT,
  } = options;

  try {
    const originalSize = image.buffer.length;
    console.log(`[Image Optimize] Processing GIF (${originalSize} bytes)`);

    let sharpInstance = sharp(image.buffer, { animated: true });
    const metadata = await sharpInstance.metadata();

    // Resize if needed
    if (metadata.width && metadata.width > maxWidth) {
      console.log(`[Image Optimize] Resizing GIF from ${metadata.width}px to ${maxWidth}px width`);
      sharpInstance = sharpInstance.resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }

    let outputBuffer: Buffer;
    let outputContentType: string;
    let outputExt: string;

    if (format === 'webp') {
      // Convert to animated WebP
      outputBuffer = await sharpInstance
        .webp({ quality, effort: 4 })
        .toBuffer();
      outputContentType = 'image/webp';
      outputExt = 'webp';
    } else {
      // Keep as GIF but resize if needed
      outputBuffer = await sharpInstance
        .gif()
        .toBuffer();
      outputContentType = 'image/gif';
      outputExt = 'gif';
    }

    const savings = originalSize - outputBuffer.length;
    const savingsPercent = ((savings / originalSize) * 100).toFixed(1);

    console.log(`[Image Optimize] GIF complete: ${originalSize} -> ${outputBuffer.length} bytes (${savingsPercent}% reduction)`);

    return {
      buffer: outputBuffer,
      contentType: outputContentType,
      ext: outputExt,
    };
  } catch (error) {
    // If optimization fails, return the original
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Image Optimize] GIF error, using original:`, message);
    return image;
  }
}

/**
 * Main entry point for image optimization
 * Handles different image types appropriately
 */
export async function processImage(
  image: ImageData,
  options: OptimizeOptions = {}
): Promise<OptimizedImage> {
  // Handle GIFs specially (may be animated)
  if (isAnimatedFormat(image.contentType)) {
    return optimizeGif(image, options);
  }

  // Standard optimization for other formats
  return optimizeImage(image, options);
}
