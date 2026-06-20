/**
 * Dealer self-service routes (all require a dealer JWT). Mounted at /api/dealers.
 *
 * GET /me               — current dealer's profile.
 * PUT /me               — update profile (validated with zod).
 * GET /me/inquiries     — paginated history of this dealer's inquiries
 *                         (page/limit + pagination envelope).
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireDealerAuth } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

const updateProfileSchema = z.object({
  ownerName: z.string().min(2).max(100).optional(),
  shopName: z.string().min(2).max(150).optional(),
  whatsappNumber: z.string().regex(/^[6-9]\d{9}$/).optional(),
  altMobile: z.string().regex(/^[6-9]\d{9}$/).optional().or(z.literal('')),
  city: z.string().min(2).max(100).optional(),
  tehsil: z.string().min(2).max(100).optional(),
  district: z.string().min(2).max(100).optional(),
  state: z.string().min(2).max(100).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  gstNumber: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .optional()
    .or(z.literal('')),
});

// GET /api/dealers/me
router.get('/me', requireDealerAuth, async (req: Request, res: Response): Promise<void> => {
  const dealer = await prisma.dealer.findUnique({
    where: { id: req.dealer!.dealerId },
    select: {
      id: true, mobile: true, ownerName: true, shopName: true,
      whatsappNumber: true, altMobile: true, city: true, tehsil: true,
      district: true, state: true, country: true, pincode: true,
      gstNumber: true, businessType: true, status: true, createdAt: true,
    },
  });

  if (!dealer) {
    res.status(404).json({ success: false, message: 'Dealer not found' });
    return;
  }

  res.json({ success: true, data: dealer });
});

// PUT /api/dealers/me
router.put('/me', requireDealerAuth, async (req: Request, res: Response): Promise<void> => {
  const parse = updateProfileSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, message: 'Validation failed', errors: parse.error.issues });
    return;
  }

  const dealer = await prisma.dealer.update({
    where: { id: req.dealer!.dealerId },
    data: {
      ...parse.data,
      altMobile: parse.data.altMobile || null,
      gstNumber: parse.data.gstNumber || null,
    },
    select: { id: true, ownerName: true, shopName: true, whatsappNumber: true, city: true, district: true, state: true, status: true },
  });

  res.json({ success: true, data: dealer });
});

// GET /api/dealers/me/inquiries
router.get('/me/inquiries', requireDealerAuth, async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const [inquiries, total] = await Promise.all([
    prisma.inquiryLog.findMany({
      where: { dealerId: req.dealer!.dealerId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.inquiryLog.count({ where: { dealerId: req.dealer!.dealerId } }),
  ]);

  res.json({
    success: true,
    data: inquiries,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export default router;
