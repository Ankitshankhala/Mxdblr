import { Router, Request, Response } from 'express';
import { InquiryStatus, Prisma } from '@prisma/client';
import { requireAdminAuth } from '../../middleware/auth';
import { requireLoadedPermission } from '../../middleware/rbac';
import prisma from '../../lib/prisma';

const router = Router();

router.use(requireAdminAuth);

// GET /api/admin/inquiries
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const rawStatus = req.query.status;
  const rawPage = req.query.page;
  const rawLimit = req.query.limit;
  const rawFrom = req.query.from;
  const rawTo = req.query.to;

  const status = typeof rawStatus === 'string' ? rawStatus : (Array.isArray(rawStatus) ? String(rawStatus[0]) : undefined);
  const pageStr = typeof rawPage === 'string' ? rawPage : (Array.isArray(rawPage) ? String(rawPage[0]) : '1');
  const limitStr = typeof rawLimit === 'string' ? rawLimit : (Array.isArray(rawLimit) ? String(rawLimit[0]) : '50');
  const fromStr = typeof rawFrom === 'string' ? rawFrom : (Array.isArray(rawFrom) ? String(rawFrom[0]) : undefined);
  const toStr = typeof rawTo === 'string' ? rawTo : (Array.isArray(rawTo) ? String(rawTo[0]) : undefined);

  const pageNum = Math.max(1, parseInt(pageStr));
  const limitNum = Math.min(100, parseInt(limitStr));
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.InquiryLogWhereInput = {};
  if (status) where.status = status as InquiryStatus;
  if (fromStr || toStr) {
    where.createdAt = {};
    if (fromStr) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(fromStr);
    if (toStr) (where.createdAt as Prisma.DateTimeFilter).lt = new Date(toStr);
  }

  const [inquiries, total] = await Promise.all([
    prisma.inquiryLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        dealer: {
          select: {
            id: true, ownerName: true, shopName: true, mobile: true,
            whatsappNumber: true, city: true, district: true, state: true,
          },
        },
      },
    }),
    prisma.inquiryLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: inquiries.map((inq) => ({
      ...inq,
      cartSnapshot: inq.cartSnapshot ?? [],
    })),
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// PUT /api/admin/inquiries/:id/status
router.put('/:id/status', requireLoadedPermission('EDIT_ORDERS'), async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status } = req.body as { status: string };

  const validStatuses: InquiryStatus[] = ['NEW', 'VIEWED', 'RESPONDED', 'CLOSED'];
  if (!validStatuses.includes(status as InquiryStatus)) {
    res.status(400).json({ success: false, message: 'Invalid status' });
    return;
  }

  const inquiry = await prisma.inquiryLog.update({
    where: { id },
    data: { status: status as InquiryStatus },
    include: { dealer: { select: { ownerName: true, shopName: true, mobile: true } } },
  });

  res.json({ success: true, data: inquiry });
});

export default router;
