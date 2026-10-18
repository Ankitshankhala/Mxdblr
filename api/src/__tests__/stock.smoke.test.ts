/**
 * Smoke floor — stock status follows stock quantity.
 *
 * Products used to be saved as IN_STOCK with quantity 0, so the dashboard's
 * Low/Out of Stock counts were meaningless. A counted quantity now decides the
 * status on every write; a null quantity means "not counted yet" and keeps a
 * hand-set status. Also guards the partial-update fix: an update that leaves a
 * field out must not reset it.
 */
import request from 'supertest';
import app from '../index';
import prisma from '../lib/prisma';
import { generateAdminToken } from '../middleware/auth';
import { DEFAULT_LOW_STOCK_THRESHOLD, stockStatusFor } from '../lib/stock';
import { createFixtures, cleanupFixtures, SmokeFixtures, RUN_ID, SKU_PREFIX } from './fixtures';

let fx: SmokeFixtures;
let token: string;
let originalThreshold: number;
let productId: string;

const put = (body: Record<string, unknown>) =>
  request(app).put(`/api/admin/products/${productId}`).set('Authorization', `Bearer ${token}`).send(body);
const patchStock = (body: Record<string, unknown>) =>
  request(app).patch(`/api/admin/products/${productId}/stock`).set('Authorization', `Bearer ${token}`).send(body);
const setThreshold = (lowStockThreshold: number) =>
  request(app).put('/api/admin/settings/stock').set('Authorization', `Bearer ${token}`).send({ lowStockThreshold });

beforeAll(async () => {
  fx = await createFixtures();
  token = generateAdminToken(fx.adminId, 'smoke_super');
  const settings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
  originalThreshold = settings?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
  expect((await setThreshold(10)).status).toBe(200);
});

afterAll(async () => {
  await setThreshold(originalThreshold);
  await cleanupFixtures();
  await prisma.$disconnect();
});

describe('stockStatusFor', () => {
  it('maps a quantity to a status around the threshold', () => {
    expect(stockStatusFor(0, 10)).toBe('OUT_OF_STOCK');
    expect(stockStatusFor(1, 10)).toBe('LOW_STOCK');
    expect(stockStatusFor(10, 10)).toBe('LOW_STOCK');
    expect(stockStatusFor(11, 10)).toBe('IN_STOCK');
  });
});

describe('Creating products', () => {
  it('without a quantity: not counted, status as chosen', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Stock Uncounted ${RUN_ID}`, brand: 'MXD', sku: `${SKU_PREFIX}-${RUN_ID}-SU` });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ stockQty: null, stockStatus: 'IN_STOCK' });
    productId = res.body.data.id;
  });

  it('with a quantity: the status comes from it, whatever status was sent', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Stock Counted ${RUN_ID}`, brand: 'MXD', sku: `${SKU_PREFIX}-${RUN_ID}-SC`, stockQty: 0, stockStatus: 'IN_STOCK' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ stockQty: 0, stockStatus: 'OUT_OF_STOCK' });
  });
});

describe('Updating a product', () => {
  it('a hand-set status is allowed while stock is not counted', async () => {
    const res = await put({ stockStatus: 'LOW_STOCK' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ stockQty: null, stockStatus: 'LOW_STOCK' });
  });

  it('entering a quantity takes over the status', async () => {
    expect((await put({ stockQty: 50, stockStatus: 'OUT_OF_STOCK' })).body.data).toMatchObject({ stockQty: 50, stockStatus: 'IN_STOCK' });
    expect((await put({ stockQty: 10 })).body.data.stockStatus).toBe('LOW_STOCK');
    expect((await put({ stockQty: 0 })).body.data.stockStatus).toBe('OUT_OF_STOCK');
  });

  it('refuses a hand-set status that would contradict a counted quantity', async () => {
    const res = await put({ stockStatus: 'IN_STOCK' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/counted \(0 pcs\)/);
    const inDb = await prisma.product.findUnique({ where: { id: productId } });
    expect(inDb).toMatchObject({ stockQty: 0, stockStatus: 'OUT_OF_STOCK' });
  });

  it('a blank quantity goes back to "not counted" with a hand-set status', async () => {
    const res = await put({ stockQty: null, stockStatus: 'IN_STOCK' });
    expect(res.body.data).toMatchObject({ stockQty: null, stockStatus: 'IN_STOCK' });
  });

  it('leaving fields out no longer resets them', async () => {
    await put({ stockQty: 40, images: ['/uploads/keep-me.webp'], attributes: [{ name: 'Length', value: '1m' }] });
    const res = await put({ moq: 7 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ moq: 7, stockQty: 40, stockStatus: 'IN_STOCK', images: ['/uploads/keep-me.webp'] });
    expect(res.body.data.attributes).toHaveLength(1);
  });
});

describe('The stock endpoint', () => {
  it('a quantity sets the status', async () => {
    const res = await patchStock({ stockQty: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ stockQty: 3, stockStatus: 'LOW_STOCK' });
  });

  it('a status alone is refused while counted, and an empty body is refused', async () => {
    expect((await patchStock({ stockStatus: 'IN_STOCK' })).status).toBe(400);
    expect((await patchStock({})).status).toBe(400);
  });
});

describe('Dashboard and threshold', () => {
  it('the summary counts products that are not counted yet', async () => {
    const res = await request(app).get('/api/admin/products/stock-summary').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.notCounted).toBe('number');
  });

  it('the list can be filtered to products that are not counted', async () => {
    await patchStock({ stockQty: null, stockStatus: 'IN_STOCK' });
    const res = await request(app)
      .get(`/api/admin/products?search=${RUN_ID}-S&stockStatus=NOT_COUNTED`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.map((p: { sku: string }) => p.sku)).toEqual([`${SKU_PREFIX}-${RUN_ID}-SU`]);
    expect(res.body.lowStockThreshold).toBe(10);
  });

  it('changing the threshold re-derives counted products straight away', async () => {
    await patchStock({ stockQty: 5 });
    expect((await prisma.product.findUnique({ where: { id: productId } }))!.stockStatus).toBe('LOW_STOCK');

    const res = await setThreshold(2);
    expect(res.status).toBe(200);
    expect(res.body.data.lowStockThreshold).toBe(2);
    expect((await prisma.product.findUnique({ where: { id: productId } }))!.stockStatus).toBe('IN_STOCK');

    await setThreshold(10);
    expect((await prisma.product.findUnique({ where: { id: productId } }))!.stockStatus).toBe('LOW_STOCK');
  });

  it('rejects a negative threshold', async () => {
    expect((await setThreshold(-1)).status).toBe(400);
  });
});
