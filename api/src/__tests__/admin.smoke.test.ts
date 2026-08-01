/**
 * Smoke floor — admin login + product CRUD.
 * Verifies admin routes are JWT-gated, CRUD round-trips against the DB,
 * and pricing fields are stripped from admin responses.
 */
import request from 'supertest';
import app from '../index';
import prisma from '../lib/prisma';
import { createFixtures, cleanupFixtures, SmokeFixtures, ADMIN_USERNAME, ADMIN_PASSWORD, RUN_ID, SKU_PREFIX } from './fixtures';

let fx: SmokeFixtures;
let adminToken: string;
let createdProductId: string;

const NEW_SKU = `${SKU_PREFIX}-${RUN_ID}-CRUD`;

beforeAll(async () => {
  fx = await createFixtures();
});

afterAll(async () => {
  await cleanupFixtures();
  await prisma.$disconnect();
});

describe('Admin authentication', () => {
  it('rejects wrong credentials with 401', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ username: ADMIN_USERNAME, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('logs in with valid credentials and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    adminToken = res.body.token;
  });

  it('blocks admin product routes without a token', async () => {
    const res = await request(app).get('/api/admin/products');
    expect(res.status).toBe(401);
  });

  it('blocks admin product routes with a dealer-type token', async () => {
    const { generateDealerToken } = await import('../middleware/auth');
    const dealerToken = generateDealerToken('fake-dealer-id', '9000000002');
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${dealerToken}`);
    expect(res.status).toBe(401);
  });
});

describe('Admin product CRUD', () => {
  it('creates a product', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Smoke CRUD Product ${RUN_ID}`,
        brand: 'SMOKETEST',
        sku: NEW_SKU,
        moq: 12,
        stockStatus: 'IN_STOCK',
        stockQty: 50,
        categoryId: fx.categoryId,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.sku).toBe(NEW_SKU);
    createdProductId = res.body.data.id;
  });

  it('strips pricing fields from admin responses', async () => {
    const res = await request(app)
      .get(`/api/admin/products?search=${NEW_SKU}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const found = res.body.data.find((p: { sku: string }) => p.sku === NEW_SKU);
    expect(found).toBeTruthy();
    expect(found.price).toBeUndefined();
    expect(found.pricingActive).toBeUndefined();
  });

  it('rejects a duplicate SKU with 409', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicate SKU attempt', brand: 'SMOKETEST', sku: NEW_SKU });
    expect(res.status).toBe(409);
  });

  it('updates the product name', async () => {
    const res = await request(app)
      .put(`/api/admin/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Smoke CRUD Product ${RUN_ID} (renamed)` });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toContain('(renamed)');
  });

  it('updates stock status via the stock endpoint', async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${createdProductId}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stockStatus: 'OUT_OF_STOCK', stockQty: 0 });
    expect(res.status).toBe(200);

    const inDb = await prisma.product.findUnique({ where: { id: createdProductId } });
    expect(inDb!.stockStatus).toBe('OUT_OF_STOCK');
  });

  it('reports stock counts in the stock summary', async () => {
    const res = await request(app)
      .get('/api/admin/products/stock-summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('deletes the product', async () => {
    const res = await request(app)
      .delete(`/api/admin/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('404s on deleting a product that no longer exists', async () => {
    const res = await request(app)
      .delete(`/api/admin/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('404s on updating a product that no longer exists (P2025 → 404, not 500)', async () => {
    const res = await request(app)
      .put(`/api/admin/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ghost product update' });
    expect(res.status).toBe(404);
  });

  it('404s on stock update for a product that no longer exists (P2025 → 404, not 500)', async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${createdProductId}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stockStatus: 'IN_STOCK' });
    expect(res.status).toBe(404);
  });
});
