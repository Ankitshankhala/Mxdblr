/**
 * Image storage — Cloudinary CDN with a local-disk fallback.
 *
 * uploadImageFromBuffer signs and uploads to Cloudinary when all three
 * CLOUDINARY_* env vars are set; otherwise it writes to ./uploads and returns a
 * `http://localhost:<port>/uploads/...` URL (dev fallback). Also provides
 * deleteImage and getOptimizedUrl (injects Cloudinary transformation params).
 * NOTE: the local-fallback URL is absolute to localhost — it breaks on other
 * devices and is only whitelisted for localhost:4000 in next.config.ts, so
 * production must run with real Cloudinary credentials.
 */
import axios from 'axios';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const API_KEY = process.env.CLOUDINARY_API_KEY || '';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function saveLocally(buffer: Buffer, mimeType: string): string | null {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const ext = MIME_TO_EXT[mimeType] || 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    const port = process.env.PORT || '4000';
    return `http://localhost:${port}/uploads/${filename}`;
  } catch {
    return null;
  }
}

function generateSignature(params: Record<string, string | number>): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto
    .createHash('sha1')
    .update(paramString + API_SECRET)
    .digest('hex');
}

export async function uploadImageFromBuffer(
  buffer: Buffer,
  folder: string,
  publicId?: string,
  mimeType = 'image/jpeg'
): Promise<string | null> {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return saveLocally(buffer, mimeType);
  }

  const timestamp = Math.round(Date.now() / 1000);
  const params: Record<string, string | number> = {
    folder,
    timestamp,
    ...(publicId ? { public_id: publicId } : {}),
  };

  const signature = generateSignature(params);

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)]);
  formData.append('file', blob);
  formData.append('api_key', API_KEY);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('folder', folder);
  if (publicId) formData.append('public_id', publicId);

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      formData,
      { timeout: 30000 }
    );
    return response.data.secure_url as string;
  } catch {
    return null;
  }
}

export async function deleteImage(publicId: string): Promise<boolean> {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return false;
  }

  const timestamp = Math.round(Date.now() / 1000);
  const params = { public_id: publicId, timestamp };
  const signature = generateSignature(params);

  try {
    await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`,
      new URLSearchParams({
        public_id: publicId,
        api_key: API_KEY,
        timestamp: String(timestamp),
        signature,
      }),
      { timeout: 10000 }
    );
    return true;
  } catch {
    return false;
  }
}

export function getOptimizedUrl(
  baseUrl: string,
  width: number,
  height: number,
  quality = 80
): string {
  if (!baseUrl.includes('cloudinary.com')) return baseUrl;
  return baseUrl.replace(
    '/upload/',
    `/upload/w_${width},h_${height},c_fill,q_${quality},f_auto/`
  );
}
