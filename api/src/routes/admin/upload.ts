import { Router, Request, Response } from 'express';
import express from 'express';
import { requireAdminAuth } from '../../middleware/auth';
import { uploadImageFromBuffer } from '../../lib/cloudinary';

const router = Router();
router.use(requireAdminAuth);

const ALLOWED_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

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

  const buffer = Buffer.from(base64Payload, 'base64');

  if (buffer.length > MAX_SIZE_BYTES) {
    res.status(400).json({ success: false, message: 'Image exceeds 5 MB limit' });
    return;
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

export default router;
