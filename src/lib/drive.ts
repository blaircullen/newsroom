import { google } from 'googleapis';
import { Readable } from 'stream';

function getAuth() {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
  const credentials = JSON.parse(serviceAccountKey);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
  });
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
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID is not configured');

  let q = "'" + folderId + "' in parents and trashed = false and (mimeType contains 'image/')";
  if (query) {
    q += " and name contains '" + query.replace(/'/g, "\\'") + "'";
  }

  const response = await drive.files.list({
    q,
    pageSize,
    pageToken: pageToken || undefined,
    fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, webViewLink, size, createdTime)',
    orderBy: 'createdTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const images: DriveImage[] = (response.data.files || []).map((file) => ({
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!,
    thumbnailUrl: '/api/drive-images/' + file.id + '/raw',
    webViewUrl: file.webViewLink || '',
    directUrl: '/api/drive-images/' + file.id + '/raw',
    size: file.size || '0',
    createdTime: file.createdTime || '',
  }));

  return { images, nextPageToken: response.data.nextPageToken || undefined };
}

export async function getDriveImageUrl(fileId: string): Promise<string> {
  return '/api/drive-images/' + fileId + '/raw';
}

export async function uploadImageToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<DriveImage> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID is not configured');

  console.log(`[Drive Upload] Starting upload: ${fileName} (${mimeType}, ${buffer.length} bytes) to folder ${folderId}`);

  // Use Readable.from() for reliable stream creation
  const stream = Readable.from(buffer);

  try {
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
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
    console.log(`[Drive Upload] Success: file ID ${file.id}`);

    return {
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      thumbnailUrl: '/api/drive-images/' + file.id + '/raw',
      webViewUrl: file.webViewLink || '',
      directUrl: '/api/drive-images/' + file.id + '/raw',
      size: file.size || '0',
      createdTime: file.createdTime || '',
    };
  } catch (error: any) {
    console.error(`[Drive Upload] Failed:`, {
      message: error.message,
      code: error.code,
      status: error.status,
      errors: error.errors,
      response: error.response?.data,
    });
    throw error;
  }
}
