/**
 * Admin media upload. Mounted at /api/admin/upload behind MANAGE_PRODUCTS.
 *
 * POST /       — base64/data-URI image (jpeg/png/webp/gif), 5 MB cap.
 * POST /video  — multipart video file (mp4/webm/mov), 50 MB cap, multer-streamed
 *                to Cloudinary (auto poster/transcode) or local-disk in dev.
 * Both hand the buffer to the cloudinary lib and return the stored URL(s). This is
 * the single server-side entry point for product/banner/event media.
 */
import { Router, Request, Response } from 'express';
import express from 'express';
import multer from 'multer';
import { requireAdminAuth } from '../../middleware/auth';
import { uploadImageFromBuffer, uploadVideoFromBuffer } from '../../lib/cloudinary';
import { sanitizeSvg } from '../../lib/svg';

const router = Router();
router.use(requireAdminAuth);

// Raster formats carry no active content and pass straight through. `image/svg+xml`
// is allowed too but is ALWAYS sanitized first (SVG can carry scripts).
const ALLOWED_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES },
});

// POST /api/admin/upload
// Accepts { data: "data:image/jpeg;base64,..." } JSON body.
// Uploads to Cloudinary, returns { url: "https://res.cloudinary.com/..." }.
// Body limit raised to 8mb to accommodate 5mb images as base64 (~33% overhead).
router.post('/', express.json({ limit: '8mb' }), async (req: Request, res: Response): Promise<void> => {
  const { data } = req.body as { data?: string };

  if (!data || typeof data !== 'string') {
    res.status(400).json({ success: false, message: 'Missing `data` field (base64 data URI required)' });
    return;
  }

  // Parse data URI: data:<mime>;base64,<payload>
  const match = data.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ success: false, message: 'Invalid data URI format' });
    return;
  }

  const [, mimeType, base64Payload] = match;

  if (!ALLOWED_MIME_PREFIXES.includes(mimeType)) {
    res.status(400).json({ success: false, message: `Unsupported image type: ${mimeType}` });
    return;
  }

  let buffer = Buffer.from(base64Payload, 'base64');

  if (buffer.length > MAX_SIZE_BYTES) {
    res.status(400).json({ success: false, message: 'Image exceeds 5 MB limit' });
    return;
  }

  // SVG is XML and can carry scripts/handlers — sanitize before it is ever stored
  // or rendered. A payload that doesn't look like an SVG is rejected outright.
  if (mimeType === 'image/svg+xml') {
    const cleaned = sanitizeSvg(buffer.toString('utf8'));
    if (!cleaned) {
      res.status(400).json({ success: false, message: 'Invalid or unsafe SVG file' });
      return;
    }
    buffer = Buffer.from(cleaned, 'utf8');
  }

  const folder = (req.query.folder as string) || 'mxdblr/uploads';
  const url = await uploadImageFromBuffer(buffer, folder, undefined, mimeType);

  if (!url) {
    res.status(503).json({
      success: false,
      message: 'Image upload failed. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.',
    });
    return;
  }

  res.json({ success: true, url });
});

// POST /api/admin/upload/video
// Multipart form-data with a single `file` field. Validates type + 50 MB size,
// streams the buffer to Cloudinary (video/upload → transcode + poster) or local
// disk in dev. Returns { url, thumbnailUrl }.
router.post('/video', (req: Request, res: Response): void => {
  videoUpload.single('file')(req, res, async (err: unknown) => {
    if (err) {
      const code = (err as { code?: string }).code;
      const message =
        code === 'LIMIT_FILE_SIZE' ? 'Video exceeds 50 MB limit' : 'Video upload failed';
      res.status(400).json({ success: false, message });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'Missing `file` field (multipart video required)' });
      return;
    }

    if (!ALLOWED_VIDEO_MIME.includes(file.mimetype)) {
      res.status(400).json({ success: false, message: `Unsupported video type: ${file.mimetype}. Allowed: mp4, webm, mov.` });
      return;
    }

    const folder = (req.query.folder as string) || 'mxdblr/events';
    const result = await uploadVideoFromBuffer(file.buffer, folder, file.mimetype);

    if (!result) {
      res.status(503).json({
        success: false,
        message: 'Video upload failed. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.',
      });
      return;
    }

    res.json({ success: true, ...result });
  });
});

export default router;
