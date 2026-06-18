import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../../middleware/auth';
import { sendWhatsAppMessage } from '../../lib/msg91';
import prisma from '../../lib/prisma';

const router = Router();

router.use(requireAdminAuth);

// GET /api/admin/notify/subscriptions
router.get('/subscriptions', async (_req: Request, res: Response): Promise<void> => {
  const subs = await prisma.notificationSubscription.findMany({
    include: {
      product: { select: { name: true, sku: true, stockStatus: true } },
      dealer: { select: { ownerName: true, shopName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: subs, count: subs.length });
});

// POST /api/admin/notify/trigger/:productId
router.post('/trigger/:productId', async (req: Request, res: Response): Promise<void> => {
  const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    res.status(404).json({ success: false, message: 'Product not found' });
    return;
  }

  const subscriptions = await prisma.notificationSubscription.findMany({
    where: { productId },
    select: { phoneNumber: true, id: true },
  });

  if (subscriptions.length === 0) {
    res.json({ success: true, message: 'No subscribers for this product', sent: 0 });
    return;
  }

  const message = `Great news! *${product.name}* (SKU: ${product.sku}) is back in stock at MXD Wholesale. Visit the portal to place your inquiry.\n\n_MXD Dealer Portal_`;

  let sentCount = 0;
  const logs: Array<{
    productId: string;
    recipientPhone: string;
    channel: 'WHATSAPP';
    message: string;
    status: string;
  }> = [];

  for (const sub of subscriptions) {
    const ok = await sendWhatsAppMessage(sub.phoneNumber, message);
    const status = ok ? 'sent' : 'failed';
    logs.push({ productId, recipientPhone: sub.phoneNumber, channel: 'WHATSAPP', message, status });
    if (ok) sentCount++;
  }

  await prisma.notificationLog.createMany({ data: logs });

  const successPhones = logs.filter((l) => l.status === 'sent').map((l) => l.recipientPhone);
  if (successPhones.length > 0) {
    await prisma.notificationSubscription.deleteMany({
      where: {
        productId,
        phoneNumber: { in: successPhones },
      },
    });
  }

  res.json({
    success: true,
    message: 'Notifications triggered',
    total: subscriptions.length,
    sent: sentCount,
    failed: subscriptions.length - sentCount,
  });
});

// GET /api/admin/notify/products-with-subs
router.get('/products-with-subs', async (_req: Request, res: Response): Promise<void> => {
  const grouped = await prisma.notificationSubscription.groupBy({
    by: ['productId'],
    _count: { id: true },
  });

  if (grouped.length === 0) {
    res.json({ success: true, data: [] });
    return;
  }

  const productIds = grouped.map((g) => g.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, stockStatus: true },
  });

  const data = products.map((p) => ({
    id: p.id,
    name: p.name,
    stockStatus: p.stockStatus,
    subscribers: grouped.find((g) => g.productId === p.id)?._count.id ?? 0,
  }));

  res.json({ success: true, data });
});

// GET /api/admin/notify/history
router.get('/history', async (_req: Request, res: Response): Promise<void> => {
  const logs = await prisma.notificationLog.findMany({
    include: { product: { select: { name: true } } },
    orderBy: { sentAt: 'desc' },
    take: 200,
  });

  type Batch = {
    productId: string;
    productName: string;
    totalRecipients: number;
    sent: number;
    failed: number;
    channel: string;
    message: string;
    sentAt: Date;
  };

  const batches: Batch[] = [];
  for (const log of logs) {
    const logTime = log.sentAt.getTime();
    const existing = batches.find(
      (b) => b.productId === log.productId && Math.abs(logTime - b.sentAt.getTime()) < 120_000
    );
    if (existing) {
      existing.totalRecipients++;
      if (log.status === 'sent') existing.sent++;
      else existing.failed++;
    } else {
      batches.push({
        productId: log.productId,
        productName: log.product.name,
        totalRecipients: 1,
        sent: log.status === 'sent' ? 1 : 0,
        failed: log.status !== 'sent' ? 1 : 0,
        channel: log.channel,
        message: log.message,
        sentAt: log.sentAt,
      });
    }
  }

  const data = batches.map((b) => ({
    ...b,
    status: b.failed === 0 ? 'SENT' : b.sent === 0 ? 'FAILED' : 'PARTIAL',
    sentAt: b.sentAt.toISOString(),
  }));

  res.json({ success: true, data });
});

// POST /api/admin/notify/broadcast
router.post('/broadcast', async (req: Request, res: Response): Promise<void> => {
  const { message, recipient, state, channel } = req.body as {
    message: string;
    recipient: string;
    state?: string;
    channel: string;
  };

  if (!message?.trim()) {
    res.status(400).json({ success: false, message: 'Message is required' });
    return;
  }

  // Build dealer filter
  const where = recipient === 'By State' && state
    ? { status: 'ACTIVE' as const, state }
    : { status: 'ACTIVE' as const };

  const dealers = await prisma.dealer.findMany({
    where,
    select: { whatsappNumber: true, ownerName: true },
  });

  if (dealers.length === 0) {
    res.json({ success: true, message: 'No dealers found for the selected recipient', sent: 0 });
    return;
  }

  let sentCount = 0;
  for (const dealer of dealers) {
    const ok = await sendWhatsAppMessage(dealer.whatsappNumber, message);
    if (ok) sentCount++;
  }

  res.json({
    success: true,
    message: 'Broadcast sent',
    total: dealers.length,
    sent: sentCount,
    failed: dealers.length - sentCount,
  });
});

export default router;
