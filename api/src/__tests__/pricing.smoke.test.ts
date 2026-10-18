/**
 * Smoke floor — dealer price lists (A/B/C) and the per-dealer on/off switch.
 *
 * Prices are financial data, so most of this suite is about who must NOT see
 * them: dealers whose prices are off, the public catalogue, and admins without
 * ACCESS_FINANCIAL_DATA. Then it checks a dealer who is switched on gets exactly
 * their own list's price on the product page endpoint and in the WhatsApp order.
 */
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../index';
import prisma from '../lib/prisma';
import { generateAdminToken, generateDealerToken } from '../middleware/auth';
import { createFixtures, cleanupFixtures, SmokeFixtures, RUN_ID } from './fixtures';

let fx: SmokeFixtures;
let superToken: string;  // SUPER_ADMIN: holds ACCESS_FINANCIAL_DATA
let staffToken: string;  // products/customers/orders, but no financial access
let dealerToken: string;
let dealerId: string;
let pricedId: string;    // A 120 / B 110 / C 99.5
let unpricedId: string;  // no prices on any list
let quotedInquiryId = ''; // the order placed while on list B

const STAFF_ROLE = `smoke_role_pricing_${RUN_ID}`;

beforeAll(async () => {
  fx = await createFixtures();
  superToken = generateAdminToken(fx.adminId, 'smoke_super');

  const role = await prisma.role.create({
    data: {
      name: STAFF_ROLE,
      rank: 50,
      permissions: {
        create: ['MANAGE_PRODUCTS', 'MANAGE_CUSTOMERS', 'CREATE_ORDERS'].map((permission) => ({
          permission: permission as 'MANAGE_PRODUCTS' | 'MANAGE_CUSTOMERS' | 'CREATE_ORDERS',
        })),
      },
    },
  });
  const staff = await prisma.adminUser.create({
    data: {
      username: `smoke_admin_pricing_${RUN_ID}`,
      passwordHash: await bcrypt.hash('test-pass-123', 10),
      roleId: role.id,
    },
  });
  staffToken = generateAdminToken(staff.id, 'smoke_staff');

  pricedId = fx.inStockProductId;
  unpricedId = fx.outOfStockProductId;
  await prisma.product.update({ where: { id: pricedId }, data: { priceA: 120, priceB: 110, priceC: 99.5 } });

  const dealer = await prisma.dealer.create({
    data: {
      mobile: `7${Date.now().toString().slice(-9)}`,
      ownerName: 'Pricing Smoke Tester',
      shopName: 'Pricing Smoke Traders',
      whatsappNumber: '9000000002',
      city: 'Bengaluru',
      tehsil: 'Bengaluru North',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      country: 'India',
      pincode: '560001',
      businessType: 'WHOLESALER',
      status: 'ACTIVE',
    },
  });
  dealerId = dealer.id;
  dealerToken = generateDealerToken(dealer.id, dealer.mobile);
});

afterAll(async () => {
  await prisma.inquiryLog.deleteMany({ where: { dealerId } });
  await prisma.auditLog.deleteMany({ where: { targetId: dealerId } });
  await prisma.dealer.deleteMany({ where: { id: dealerId } });
  await cleanupFixtures(); // removes smoke_admin_* users, incl. the staff user
  await prisma.role.deleteMany({ where: { name: STAFF_ROLE } });
  await prisma.$disconnect();
});

const pricesFor = (token: string) =>
  request(app)
    .get(`/api/dealers/me/prices?ids=${pricedId},${unpricedId}`)
    .set('Authorization', `Bearer ${token}`);

const setPricing = (token: string, body: Record<string, unknown>) =>
  request(app)
    .put(`/api/admin/dealers/${dealerId}/pricing`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);

const placeInquiry = () =>
  request(app)
    .post('/api/inquiry')
    .set('Authorization', `Bearer ${dealerToken}`)
    .send({ items: [{ productId: pricedId, quantity: 10 }, { productId: unpricedId, quantity: 2 }] });

describe('Prices stay hidden by default', () => {
  it('a new dealer has prices switched off', async () => {
    const res = await pricesFor(dealerToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ showPrices: false });
  });

  it('the prices endpoint needs a dealer session', async () => {
    expect((await request(app).get(`/api/dealers/me/prices?ids=${pricedId}`)).status).toBe(401);
    expect((await pricesFor(superToken)).status).toBe(401);
  });

  it('the public product response never carries prices', async () => {
    const res = await request(app).get(`/api/products/${pricedId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.priceA).toBeUndefined();
    expect(res.body.data.priceB).toBeUndefined();
    expect(res.body.data.priceC).toBeUndefined();
  });

  it('the order message asks for pricing and stores no prices', async () => {
    const res = await placeInquiry();
    expect(res.status).toBe(201);
    expect(res.body.data.whatsappMessage).toMatch(/share pricing/);
    expect(res.body.data.whatsappMessage).not.toMatch(/₹/);
    const inquiry = await prisma.inquiryLog.findUnique({ where: { id: res.body.data.inquiryId } });
    const items = inquiry!.cartSnapshot as Array<Record<string, unknown>>;
    expect(items[0]).not.toHaveProperty('unitPrice');
  });
});

describe('Admins without ACCESS_FINANCIAL_DATA', () => {
  it('cannot change a dealer price list', async () => {
    const res = await setPricing(staffToken, { priceTier: 'B', showPrices: true });
    expect(res.status).toBe(403);
  });

  it('do not see product prices', async () => {
    const res = await request(app)
      .get(`/api/admin/products?search=${encodeURIComponent(`${RUN_ID}-A`)}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].priceA).toBeUndefined();
  });

  it('cannot set prices through the product form or the inline edit', async () => {
    const form = await request(app)
      .put(`/api/admin/products/${pricedId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ priceA: 1 });
    expect(form.status).toBe(403);
    const inline = await request(app)
      .patch(`/api/admin/products/${pricedId}/prices`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ priceA: 1 });
    expect(inline.status).toBe(403);
    const product = await prisma.product.findUnique({ where: { id: pricedId } });
    expect(product!.priceA).toBe(120);
  });

  it('can still save the product form when it carries no prices', async () => {
    const res = await request(app)
      .put(`/api/admin/products/${pricedId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ moq: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.priceA).toBeUndefined();
  });
});

describe('Admin switches a dealer onto price list B', () => {
  it('rejects an unknown price list', async () => {
    const res = await setPricing(superToken, { priceTier: 'D', showPrices: true });
    expect(res.status).toBe(400);
  });

  it('saves the list and the switch, and audits the change', async () => {
    const res = await setPricing(superToken, { priceTier: 'B', showPrices: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ priceTier: 'B', showPrices: true });

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'DEALER_PRICING_CHANGED', targetId: dealerId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.details).toMatchObject({ priceTier: 'B', showPrices: true, previous: 'A · hidden' });
  });

  it('the dealer sees only their own list, never which list it is', async () => {
    const res = await pricesFor(dealerToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ showPrices: true, prices: { [pricedId]: 110, [unpricedId]: null } });
  });

  it('the order message quotes list B with a total, and the snapshot keeps the quote', async () => {
    const res = await placeInquiry();
    expect(res.status).toBe(201);
    const msg: string = res.body.data.whatsappMessage;
    expect(msg).toContain('Qty: 10 × ₹110 = ₹1,100');
    expect(msg).toContain('Qty: 2 — price on request');
    expect(msg).toContain('*Total: ₹1,100* (+ 1 item on request)');
    expect(msg).toContain('share pricing for the items on request');
    expect(msg).not.toMatch(/₹120|₹99/);

    quotedInquiryId = res.body.data.inquiryId;
    const inquiry = await prisma.inquiryLog.findUnique({ where: { id: quotedInquiryId } });
    const items = inquiry!.cartSnapshot as Array<Record<string, unknown>>;
    expect(items[0]).toMatchObject({ productId: pricedId, unitPrice: 110, priceTier: 'B' });
    expect(items[1]).toMatchObject({ productId: unpricedId, unitPrice: null });
    expect((items[0].product as Record<string, unknown>).priceA).toBeUndefined();
  });

  it('only admins with financial access see the quoted prices on the order', async () => {
    const find = async (token: string) => {
      const res = await request(app).get('/api/admin/orders?limit=100').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      return res.body.data.find((i: { id: string }) => i.id === quotedInquiryId);
    };
    const asSuper = await find(superToken);
    expect(asSuper.cartSnapshot[0].unitPrice).toBe(110);
    const asStaff = await find(staffToken);
    expect(asStaff.cartSnapshot[0].unitPrice).toBeUndefined();
    expect(asStaff.cartSnapshot[0].quantity).toBe(10);
  });

  it('moving the dealer to list C changes their price, paise included', async () => {
    await setPricing(superToken, { priceTier: 'C', showPrices: true });
    const res = await placeInquiry();
    expect(res.body.data.whatsappMessage).toContain('Qty: 10 × ₹99.50 = ₹995');
  });

  it('switching prices off hides them again', async () => {
    await setPricing(superToken, { priceTier: 'C', showPrices: false });
    expect((await pricesFor(dealerToken)).body.data).toEqual({ showPrices: false });
    expect((await placeInquiry()).body.data.whatsappMessage).not.toMatch(/₹/);
  });
});

describe('Admin with financial access edits product prices', () => {
  it('sees all three lists on the product', async () => {
    const res = await request(app)
      .get(`/api/admin/products?search=${encodeURIComponent(`${RUN_ID}-A`)}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.body.data[0]).toMatchObject({ priceA: 120, priceB: 110, priceC: 99.5 });
    expect(res.body.data[0].price).toBeUndefined();
  });

  it('inline edit rounds to paise and null clears a price', async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${pricedId}/prices`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ priceA: 125.456, priceC: null });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ priceA: 125.46, priceB: 110, priceC: null });
  });

  it('rejects negative prices and empty edits', async () => {
    const send = (body: Record<string, unknown>) =>
      request(app)
        .patch(`/api/admin/products/${pricedId}/prices`)
        .set('Authorization', `Bearer ${superToken}`)
        .send(body);
    expect((await send({ priceB: -1 })).status).toBe(400);
    expect((await send({})).status).toBe(400);
  });
});
