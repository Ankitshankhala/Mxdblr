/**
 * Admin system settings. Mounted at /api/admin/settings behind SYSTEM_SETTINGS.
 *
 * GET/PUT non-sensitive config plus PUT /change-password (admin password).
 * Secret-bearing fields are masked on read via maskSecret and default empty.
 * NOTE: API keys must NOT live here long-term — real credentials belong in env
 * vars (TODO in source); these DB fields are slated for removal.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAdminAuth } from '../../middleware/auth';
import prisma from '../../lib/prisma';

const router = Router();
router.use(requireAdminAuth);

const settingsSchema = z.object({
  whatsappNumber: z.string().max(20).default(''),
  msg91ApiKey: z.string().max(200).default(''),
  cloudinaryCloud: z.string().max(100).default(''),
  cloudinaryApiKey: z.string().max(200).default(''),
  cloudinaryApiSecret: z.string().max(200).default(''),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(100),
});

const SETTINGS_ID = 1;

const emptySettings = {
  whatsappNumber: '',
  msg91ApiKey: '',
  cloudinaryCloud: '',
  cloudinaryApiKey: '',
  cloudinaryApiSecret: '',
};

// TODO: Move to env vars in next sprint — never store API secrets in DB
function maskSecret(value: string | null | undefined): string {
  if (!value) return '';
  return '••••••' + value.slice(-4);
}

const MASK_PATTERN = /^••••••.{0,4}$/;

// CRIT-4 fix: GET returns masked secrets for display. If the client round-trips
// that masked value back on PUT without editing it, this previously overwrote
// the real secret with the literal "••••••xxxx" string — silent data
// corruption behind a success toast. Any field matching the mask shape is
// treated as "unchanged" and the existing DB value is kept instead.
function resolveSecretField(incoming: string, existing: string | null | undefined): string {
  if (MASK_PATTERN.test(incoming)) return existing || '';
  return incoming;
}

// GET /api/admin/settings
// Sensitive API keys/secrets are masked — last 4 chars only, never returned in full.
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (!settings) {
      res.json({ success: true, settings: emptySettings });
      return;
    }
    res.json({
      success: true,
      settings: {
        whatsappNumber: settings.whatsappNumber,
        cloudinaryCloud: settings.cloudinaryCloud,
        // Sensitive fields — masked for display only
        msg91ApiKey: maskSecret(settings.msg91ApiKey),
        cloudinaryApiKey: maskSecret(settings.cloudinaryApiKey),
        cloudinaryApiSecret: maskSecret(settings.cloudinaryApiSecret),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
});

// PUT /api/admin/settings
router.put('/', async (req: Request, res: Response): Promise<void> => {
  const parse = settingsSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, message: parse.error.issues[0].message });
    return;
  }

  try {
    const existing = await prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } });

    const resolved = {
      ...parse.data,
      msg91ApiKey: resolveSecretField(parse.data.msg91ApiKey, existing?.msg91ApiKey),
      cloudinaryApiKey: resolveSecretField(parse.data.cloudinaryApiKey, existing?.cloudinaryApiKey),
      cloudinaryApiSecret: resolveSecretField(parse.data.cloudinaryApiSecret, existing?.cloudinaryApiSecret),
    };

    const settings = await prisma.systemSettings.upsert({
      where: { id: SETTINGS_ID },
      update: resolved,
      create: { id: SETTINGS_ID, ...resolved },
    });
    res.json({
      success: true,
      settings: {
        whatsappNumber: settings.whatsappNumber,
        cloudinaryCloud: settings.cloudinaryCloud,
        msg91ApiKey: maskSecret(settings.msg91ApiKey),
        cloudinaryApiKey: maskSecret(settings.cloudinaryApiKey),
        cloudinaryApiSecret: maskSecret(settings.cloudinaryApiSecret),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save settings' });
  }
});

// PUT /api/admin/settings/change-password
router.put('/change-password', async (req: Request, res: Response): Promise<void> => {
  const parse = changePasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, message: parse.error.issues[0].message });
    return;
  }

  const { currentPassword, newPassword } = parse.data;
  const adminId = req.admin!.adminId;

  try {
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) {
      res.status(404).json({ success: false, message: 'Admin user not found' });
      return;
    }

    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.adminUser.update({ where: { id: adminId }, data: { passwordHash: hash } });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update password' });
  }
});

export default router;
