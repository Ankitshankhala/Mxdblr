/**
 * Admin dealer (customer) management. Mounted at /api/admin/dealers behind
 * MANAGE_CUSTOMERS.
 *
 * GET /              — filterable, paginated dealer list.
 * GET /:id           — single dealer detail.
 * PUT /:id/moderate  — approve / block / suspend a dealer (moderation action;
 *                      a block bumps lastRevokedAt to kill active sessions).
 */
import { Router, Request, Response } from 'express';
import { DealerStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAdminAuth } from '../../middleware/auth';
import prisma from '../../lib/prisma';

const router = Router();

router.use(requireAdminAuth);

const moderationSchema = z.object({
  action: z.enum(['SUSPEND', 'BLOCK', 'REJECT', 'ACTIVATE']),
  reason: z.string().min(5).max(500).optional(),
});

// GET /api/admin/dealers
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const rawStatus = req.query.status;
  const rawSearch = req.query.search;
  const rawPage = req.query.page;
  const rawLimit = req.query.limit;

  const status = typeof rawStatus === 'string' ? rawStatus : (Array.isArray(rawStatus) ? String(rawStatus[0]) : undefined);
  const search = typeof rawSearch === 'string' ? rawSearch : (Array.isArray(rawSearch) ? String(rawSearch[0]) : undefined);
  const pageStr = typeof rawPage === 'string' ? rawPage : (Array.isArray(rawPage) ? String(rawPage[0]) : '1');
  const limitStr = typeof rawLimit === 'string' ? rawLimit : (Array.isArray(rawLimit) ? String(rawLimit[0]) : '50');

  const pageNum = Math.max(1, parseInt(pageStr));
  const limitNum = Math.min(100, parseInt(limitStr));
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.DealerWhereInput = {};
  if (status) where.status = status as DealerStatus;
  if (search && typeof search === 'string') {
    where.OR = [
      { ownerName: { contains: search } },
      { shopName: { contains: search } },
      { mobile: { contains: search } },
      { district: { contains: search } },
    ];
  }

  const [dealers, total] = await Promise.all([
    prisma.dealer.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, mobile: true, ownerName: true, shopName: true,
        city: true, district: true, state: true, businessType: true,
        status: true, createdAt: true,
        _count: { select: { cartItems: true, inquiries: true } },
      },
    }),
    prisma.dealer.count({ where }),
  ]);

  res.json({
    success: true,
    data: dealers,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// GET /api/admin/dealers/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const dealer = await prisma.dealer.findUnique({
    where: { id },
    include: {
      moderationLogs: {
        include: { admin: { select: { username: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      inquiries: { orderBy: { createdAt: 'desc' }, take: 10 },
      _count: { select: { cartItems: true, inquiries: true, notificationSubs: true } },
    },
  });

  if (!dealer) {
    res.status(404).json({ success: false, message: 'Dealer not found' });
    return;
  }

  res.json({ success: true, data: dealer });
});

// PUT /api/admin/dealers/:id/moderate
router.put('/:id/moderate', async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parse = moderationSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, errors: parse.error.issues });
    return;
  }

  const { action, reason } = parse.data;
  const adminId = req.admin!.adminId;

  const statusMap: Record<string, DealerStatus> = {
    SUSPEND: 'SUSPENDED',
    BLOCK: 'BLOCKED',
    REJECT: 'REJECTED',
    ACTIVATE: 'ACTIVE',
  };

  const newStatus = statusMap[action];

  // Revoke all active sessions by setting lastRevokedAt when blocking or suspending
  const shouldRevoke = action === 'BLOCK' || action === 'SUSPEND';

  const [dealer] = await Promise.all([
    prisma.dealer.update({
      where: { id },
      data: {
        status: newStatus,
        ...(shouldRevoke && { lastRevokedAt: new Date() }),
      },
      select: { id: true, ownerName: true, shopName: true, status: true },
    }),
    prisma.moderationLog.create({
      data: { dealerId: id, action, adminId, reason: reason || null },
    }),
  ]);

  res.json({ success: true, data: dealer });
});

export default router;
