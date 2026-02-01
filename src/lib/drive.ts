import { google } from 'googleapis';

function getAuth() {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
  }

  const credentials = JSON.parse(serviceAccountKey);
  
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
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

  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID is not configured');
  }

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
  });

  const images: DriveImage[] = (response.data.files || []).map((file) => ({
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!,
    thumbnailUrl: '/api/drive-images/' + file.id + '/raw?w=400',
    webViewUrl: file.webViewLink || '',
    directUrl: '/api/drive-images/' + file.id + '/raw',
    size: file.size || '0',
    createdTime: file.createdTime || '',
  }));

  return {
    images,
    nextPageToken: response.data.nextPageToken || undefined,
  };
}

export async function getDriveImageUrl(fileId: string): Promise<string> {
  return '/api/drive-images/' + fileId + '/raw';
}
