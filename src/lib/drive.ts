import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

// Cache the drive instance to avoid recreating it on every request
let cachedDrive: drive_v3.Drive | null = null;

function getDrive(): drive_v3.Drive {
  if (cachedDrive) return cachedDrive;

  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
  }

  try {
    const credentials = JSON.parse(serviceAccountKey);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
    });
    cachedDrive = google.drive({ version: 'v3', auth });
    return cachedDrive;
  } catch {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY format');
  }
}

export interface DriveImage {
  id: string;
  name: string;
  mimeType: string;
  thumbnailUrl: string;
  webViewUrl: string;
  directUrl: string;
  size: string;
  createdTime: string;
}

export async function searchDriveImages(
  query?: string,
  pageToken?: string,
  pageSize: number = 30
): Promise<{ images: DriveImage[]; nextPageToken?: string }> {
  const drive = getDrive();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID is not configured');

  // Validate pageSize to prevent abuse
  const validPageSize = Math.min(Math.max(1, pageSize), 100);

  // Build query with proper escaping to prevent injection
  const escapedQuery = query?.replace(/\\/g, '\\\\').replace(/'/g, "\\'") || '';
  let q = `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`;
  if (escapedQuery) {
    q += ` and name contains '${escapedQuery}'`;
  }

  const response = await drive.files.list({
    q,
    pageSize: validPageSize,
    pageToken: pageToken || undefined,
    fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, webViewLink, size, createdTime)',
    orderBy: 'createdTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = response.data.files || [];
  const images: DriveImage[] = files
    .filter((file): file is typeof file & { id: string; name: string; mimeType: string } =>
      Boolean(file.id && file.name && file.mimeType)
    )
    .map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      thumbnailUrl: `/api/drive-images/${file.id}/raw`,
      webViewUrl: file.webViewLink || '',
      directUrl: `/api/drive-images/${file.id}/raw`,
      size: file.size || '0',
      createdTime: file.createdTime || '',
    }));

  return { images, nextPageToken: response.data.nextPageToken || undefined };
}

export async function getDriveImageUrl(fileId: string): Promise<string> {
  return '/api/drive-images/' + fileId + '/raw';
}

// Allowed MIME types for upload security
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

// Max file size: 20MB
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function uploadImageToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<DriveImage> {
  // Validate inputs
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Invalid mime type: ${mimeType}. Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`);
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${buffer.length} bytes. Maximum: ${MAX_FILE_SIZE} bytes`);
  }

  if (!fileName || fileName.length > 255) {
    throw new Error('Invalid file name');
  }

  const drive = getDrive();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID is not configured');

  // Sanitize filename to prevent path traversal
  const sanitizedFileName = fileName.replace(/[/\\:*?"<>|]/g, '_');

  console.log(`[Drive Upload] Starting upload: ${sanitizedFileName} (${mimeType}, ${buffer.length} bytes)`);

  const stream = Readable.from(buffer);

  try {
    const response = await drive.files.create({
      requestBody: {
        name: sanitizedFileName,
        mimeType,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id, name, mimeType, thumbnailLink, webViewLink, size, createdTime',
      supportsAllDrives: true,
    });

    const file = response.data;
    if (!file.id || !file.name || !file.mimeType) {
      throw new Error('Incomplete response from Drive API');
    }

    console.log(`[Drive Upload] Success: file ID ${file.id}`);

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      thumbnailUrl: `/api/drive-images/${file.id}/raw`,
      webViewUrl: file.webViewLink || '',
      directUrl: `/api/drive-images/${file.id}/raw`,
      size: file.size || '0',
      createdTime: file.createdTime || '',
    };
  } catch (error) {
    const err = error as { message?: string; code?: string; status?: number; errors?: unknown };
    console.error(`[Drive Upload] Failed:`, {
      message: err.message,
      code: err.code,
      status: err.status,
      errors: err.errors,
    });
    throw error;
  }
}
