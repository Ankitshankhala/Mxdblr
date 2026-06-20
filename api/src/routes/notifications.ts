/**
 * Mixed-auth notification + inquiry routes. Mounted at /api (index.ts).
 *
 * POST /notify-me   — public back-in-stock subscription for a product.
 * POST /inquiry     — dealer-auth; turns the cart into a persisted inquiry with a
 *                     cartSnapshot and returns the wa.me WhatsApp deep link.
 * GET  /geo/check   — reports whether the caller's region is served (used by the
 *                     frontend geo gate).
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireDealerAuth } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

const notifyMeSchema = z.object({
  productId: z.string().min(1),
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
});

const inquirySchema = z.object({
  items: z
    .array(z.object({ productId: z.string(), quantity: z.number().int().positive() }))
    .min(1, 'At least one item required'),
  notes: z.string().max(500).optional(),
});

// POST /api/notify-me
router.post('/notify-me', async (req: Request, res: Response): Promise<void> => {
  const parse = notifyMeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, message: parse.error.issues[0].message });
    return;
  }

  const { productId, phoneNumber } = parse.data;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    res.status(404).json({ success: false, message: 'Product not found' });
    return;
  }

  if (product.stockStatus === 'IN_STOCK') {
    res.status(400).json({ success: false, message: 'Product is already in stock' });
    return;
  }

  let dealerId: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const jwt = await import('jsonwebtoken');
      const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as { type?: string; dealerId?: string };
      if (payload.type === 'dealer') dealerId = payload.dealerId;
    } catch {
      // anonymous — fine
    }
  }

  await prisma.notificationSubscription.upsert({
    where: { phoneNumber_productId: { phoneNumber, productId } },
    update: { dealerId: dealerId || null },
    create: { phoneNumber, productId, dealerId: dealerId || null },
  });

  res.json({ success: true, message: 'You will be notified when this product is back in stock' });
});

// POST /api/inquiry
router.post('/inquiry', requireDealerAuth, async (req: Request, res: Response): Promise<void> => {
  const dealerId = req.dealer!.dealerId;

  const parse = inquirySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, message: parse.error.issues[0].message });
    return;
  }

  const dealer = await prisma.dealer.findUnique({
    where: { id: dealerId },
    select: { ownerName: true, shopName: true, whatsappNumber: true },
  });
  if (!dealer) {
    res.status(404).json({ success: false, message: 'Dealer not found' });
    return;
  }

  const productIds = parse.data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, brand: true, sku: true, moq: true },
  });

  const cartSnapshot = parse.data.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    product: products.find((p) => p.id === item.productId) || null,
  }));

  const inquiry = await prisma.inquiryLog.create({
    data: { dealerId, cartSnapshot, status: 'NEW' },
  });

  const { buildInquiryWhatsAppMessage } = await import('../lib/msg91');
  const itemsForMessage = products.map((p) => ({
    name: p.name,
    sku: p.sku,
    quantity: parse.data.items.find((i) => i.productId === p.id)?.quantity || 1,
  }));

  const whatsappMessage = buildInquiryWhatsAppMessage(dealer.ownerName, dealer.shopName, itemsForMessage);

  res.status(201).json({
    success: true,
    data: { inquiryId: inquiry.id, whatsappMessage, whatsappNumber: process.env.WHATSAPP_BUSINESS_NUMBER },
  });
});

// GET /api/geo/check
router.get('/geo/check', async (req: Request, res: Response): Promise<void> => {
  const { extractClientIp, getClientState, checkStateAllowed } = await import('../middleware/geo');

  const ip = extractClientIp(req);
  const state = await getClientState(ip);

  if (!state) {
    // Can't determine state (private IP, lookup failed) — allow by default
    res.json({ success: true, allowed: true, state: null, ip });
    return;
  }

  const allowed = await checkStateAllowed(state);
  res.json({ success: true, allowed, state, ip });
});

export default router;
