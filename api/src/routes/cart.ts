/**
 * Dealer cart routes (all require a dealer JWT). Mounted at /api/cart.
 *
 * GET /                 — current dealer's cart with product detail.
 * POST /                — add/update an item; enforces MOQ and out-of-stock
 *                         rules server-side (the cart cannot be gamed client-side).
 * DELETE /:productId    — remove one line. DELETE / — clear the cart.
 * The cart is the basis for the WhatsApp inquiry (see routes/notifications.ts).
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireDealerAuth } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

// GET /api/cart
router.get('/', requireDealerAuth, async (req: Request, res: Response): Promise<void> => {
  const dealerId = req.dealer!.dealerId;

  const items = await prisma.cartItem.findMany({
    where: { dealerId },
    include: {
      product: {
        select: {
          id: true, name: true, brand: true, sku: true, moq: true,
          stockStatus: true, images: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json({
    success: true,
    data: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      product: item.product,
    })),
    count: items.length,
  });
});

// POST /api/cart
router.post('/', requireDealerAuth, async (req: Request, res: Response): Promise<void> => {
  const dealerId = req.dealer!.dealerId;

  const parse = cartItemSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, message: parse.error.issues[0].message });
    return;
  }

  const { productId, quantity } = parse.data;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    res.status(404).json({ success: false, message: 'Product not found' });
    return;
  }

  if (product.stockStatus === 'OUT_OF_STOCK') {
    res.status(400).json({ success: false, message: 'This product is currently out of stock.' });
    return;
  }

  if (quantity < product.moq) {
    res.status(400).json({
      success: false,
      message: `Minimum order quantity for this product is ${product.moq}`,
      moq: product.moq,
    });
    return;
  }

  const cartItem = await prisma.cartItem.upsert({
    where: { dealerId_productId: { dealerId, productId } },
    update: { quantity },
    create: { dealerId, productId, quantity },
    include: {
      product: { select: { id: true, name: true, brand: true, sku: true, moq: true, stockStatus: true, images: true } },
    },
  });

  res.json({ success: true, data: cartItem });
});

// DELETE /api/cart/:productId
router.delete('/:productId', requireDealerAuth, async (req: Request, res: Response): Promise<void> => {
  const dealerId = req.dealer!.dealerId;
  const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;

  const existing = await prisma.cartItem.findUnique({
    where: { dealerId_productId: { dealerId, productId } },
  });

  if (!existing) {
    res.status(404).json({ success: false, message: 'Cart item not found' });
    return;
  }

  await prisma.cartItem.delete({ where: { dealerId_productId: { dealerId, productId } } });
  res.json({ success: true, message: 'Item removed from cart' });
});

// DELETE /api/cart
router.delete('/', requireDealerAuth, async (req: Request, res: Response): Promise<void> => {
  const dealerId = req.dealer!.dealerId;
  await prisma.cartItem.deleteMany({ where: { dealerId } });
  res.json({ success: true, message: 'Cart cleared' });
});

export default router;
