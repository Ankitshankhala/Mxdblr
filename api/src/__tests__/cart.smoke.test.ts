/**
 * Smoke floor — cart + WhatsApp inquiry (the core business flow).
 * Creates its own dealer + products, asserts MOQ/stock enforcement happens
 * server-side, and verifies the inquiry persists a cart snapshot.
 */
import request from 'supertest';
import app from '../index';
import prisma from '../lib/prisma';
import { createFixtures, cleanupFixtures, SmokeFixtures } from './fixtures';
import { generateDealerToken } from '../middleware/auth';

let fx: SmokeFixtures;
let dealerToken: string;
let dealerId: string;

beforeAll(async () => {
  fx = await createFixtures();
  // Dealer created directly (auth flow is covered by auth.smoke.test.ts)
  const dealer = await prisma.dealer.create({
    data: {
      mobile: `8${Date.now().toString().slice(-9)}`,
      ownerName: 'Cart Smoke Tester',
      shopName: 'Cart Smoke Traders',
      whatsappNumber: '9000000001',
      city: 'Chennai',
      tehsil: 'Chennai North',
      district: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      pincode: '600001',
      businessType: 'RETAIL_SHOP',
      status: 'ACTIVE',
    },
  });
  dealerId = dealer.id;
  dealerToken = generateDealerToken(dealer.id, dealer.mobile);
});

afterAll(async () => {
  await prisma.cartItem.deleteMany({ where: { dealerId } });
  await prisma.inquiryLog.deleteMany({ where: { dealerId } });
  await prisma.dealer.deleteMany({ where: { id: dealerId } });
  await cleanupFixtures();
  await prisma.$disconnect();
});

describe('Cart access control', () => {
  it('rejects cart access without a token', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
  });

  it('rejects cart access with an admin-type token', async () => {
    const { generateAdminToken } = await import('../middleware/auth');
    const adminToken = generateAdminToken(fx.adminId, 'smoke');
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(401);
  });
});

describe('Cart business rules (server-side)', () => {
  it('rejects quantity below MOQ', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${dealerToken}`)
      .send({ productId: fx.inStockProductId, quantity: 2 }); // MOQ is 5
    expect(res.status).toBe(400);
    expect(res.body.moq).toBe(5);
  });

  it('rejects an out-of-stock product', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${dealerToken}`)
      .send({ productId: fx.outOfStockProductId, quantity: 10 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/out of stock/i);
  });

  it('adds a valid item to the cart', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${dealerToken}`)
      .send({ productId: fx.inStockProductId, quantity: 10 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.quantity).toBe(10);
  });

  it('returns the cart with product details', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${dealerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].product.sku).toContain('TEST-SMOKE');
  });
});

describe('WhatsApp inquiry flow', () => {
  it('creates an inquiry with a persisted cart snapshot', async () => {
    const res = await request(app)
      .post('/api/inquiry')
      .set('Authorization', `Bearer ${dealerToken}`)
      .send({ items: [{ productId: fx.inStockProductId, quantity: 10 }] });
    expect(res.status).toBe(201);
    expect(res.body.data.inquiryId).toBeTruthy();
    expect(res.body.data.whatsappMessage).toContain('MXD Wholesale Inquiry');

    const log = await prisma.inquiryLog.findUnique({ where: { id: res.body.data.inquiryId } });
    expect(log).not.toBeNull();
    expect(log!.status).toBe('NEW');
    const snapshot = log!.cartSnapshot as Array<{ productId: string; quantity: number }>;
    expect(snapshot[0].productId).toBe(fx.inStockProductId);
    expect(snapshot[0].quantity).toBe(10);
  });

  it('lists the inquiry in the dealer history', async () => {
    const res = await request(app)
      .get('/api/dealers/me/inquiries')
      .set('Authorization', `Bearer ${dealerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
  });
});

describe('Cart removal', () => {
  it('removes a single item', async () => {
    const res = await request(app)
      .delete(`/api/cart/${fx.inStockProductId}`)
      .set('Authorization', `Bearer ${dealerToken}`);
    expect(res.status).toBe(200);
  });

  it('404s when removing an item not in the cart', async () => {
    const res = await request(app)
      .delete(`/api/cart/${fx.inStockProductId}`)
      .set('Authorization', `Bearer ${dealerToken}`);
    expect(res.status).toBe(404);
  });

  it('clears the cart', async () => {
    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${dealerToken}`)
      .send({ productId: fx.inStockProductId, quantity: 5 });
    const res = await request(app).delete('/api/cart').set('Authorization', `Bearer ${dealerToken}`);
    expect(res.status).toBe(200);

    const after = await request(app).get('/api/cart').set('Authorization', `Bearer ${dealerToken}`);
    expect(after.body.count).toBe(0);
  });
});
