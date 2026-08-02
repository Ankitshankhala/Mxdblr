/**
 * Smoke floor — POST /api/admin/products/bulk-features.
 *
 * Verifies: RBAC gating, the three modes (add / replace / remove), that `add` is
 * idempotent and preserves existing links and their displayOrder, that `replace`
 * overwrites the whole set, that an empty featureSlugs list is rejected for
 * add/remove but clears the set for replace, and that unknown product ids and
 * feature slugs are REPORTED back rather than silently dropped.
 *
 * Admin, products and features are all created inline and stamped with RUN_ID so
 * cleanup can only ever delete this run's rows.
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../index';
import prisma from '../lib/prisma';
import { ALL_PERMISSIONS, SUPER_ADMIN_ROLE } from '../lib/rbac';
import { ADMIN_USERNAME, ADMIN_PASSWORD, RUN_ID } from './fixtures';

let adminToken: string;
let productA: string;
let productB: string;
let categoryId: string;

const TAG = `bf${RUN_ID}`;
const SLUG_A = `${TAG}-alpha`;
const SLUG_B = `${TAG}-beta`;
const SLUG_C = `${TAG}-gamma`;

const auth = () => ({ Authorization: `Bearer ${adminToken}` });

/** Ordered feature slugs currently linked to a product. */
async function linkedSlugs(productId: string): Promise<string[]> {
  const links = await prisma.productFeatureLink.findMany({
    where: { productId },
    orderBy: { displayOrder: 'asc' },
    include: { feature: { select: { slug: true } } },
  });
  return links.map((l) => l.feature.slug);
}

beforeAll(async () => {
  const superRole = await prisma.role.upsert({
    where: { name: SUPER_ADMIN_ROLE },
    update: {},
    create: { name: SUPER_ADMIN_ROLE, description: 'Full access', isSystem: true, rank: 0 },
  });
  await prisma.rolePermission.createMany({
    data: ALL_PERMISSIONS.map((permission) => ({ roleId: superRole.id, permission })),
    skipDuplicates: true,
  });
  await prisma.adminUser.create({
    data: { username: ADMIN_USERNAME, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10), roleId: superRole.id },
  });

  const category = await prisma.category.create({
    data: { name: `Bulk Cat ${RUN_ID}`, slug: `bulk-cat-${RUN_ID}`, displayOrder: 99 },
  });
  categoryId = category.id;

  const a = await prisma.product.create({
    data: { name: `Bulk A ${RUN_ID}`, brand: 'MXD', sku: `${TAG}-A`, moq: 10, stockQty: 10, categoryId },
  });
  const b = await prisma.product.create({
    data: { name: `Bulk B ${RUN_ID}`, brand: 'MXD', sku: `${TAG}-B`, moq: 10, stockQty: 10, categoryId },
  });
  productA = a.id;
  productB = b.id;

  await prisma.productFeature.createMany({
    data: [
      { name: 'Alpha', slug: SLUG_A, category: 'CHARGING' },
      { name: 'Beta', slug: SLUG_B, category: 'CHARGING' },
      { name: 'Gamma', slug: SLUG_C, category: 'DATA' },
    ],
  });

  const login = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  adminToken = login.body.token;
});

afterAll(async () => {
  await prisma.productFeatureLink.deleteMany({ where: { productId: { in: [productA, productB] } } });
  await prisma.productFeature.deleteMany({ where: { slug: { in: [SLUG_A, SLUG_B, SLUG_C] } } });
  await prisma.product.deleteMany({ where: { id: { in: [productA, productB] } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.adminUser.deleteMany({ where: { username: ADMIN_USERNAME } });
  await prisma.$disconnect();
});

describe('bulk-features access control', () => {
  it('rejects an unauthenticated call (401)', async () => {
    const res = await request(app)
      .post('/api/admin/products/bulk-features')
      .send({ productIds: [productA], featureSlugs: [SLUG_A], mode: 'add' });
    expect(res.status).toBe(401);
  });
});

describe('bulk-features validation', () => {
  it('rejects an unknown mode (400)', async () => {
    const res = await request(app)
      .post('/api/admin/products/bulk-features')
      .set(auth())
      .send({ productIds: [productA], featureSlugs: [SLUG_A], mode: 'sideways' });
    expect(res.status).toBe(400);
  });

  it('rejects an empty productIds list (400)', async () => {
    const res = await request(app)
      .post('/api/admin/products/bulk-features')
      .set(auth())
      .send({ productIds: [], featureSlugs: [SLUG_A], mode: 'add' });
    expect(res.status).toBe(400);
  });

  it('rejects empty featureSlugs for add (400)', async () => {
    const res = await request(app)
      .post('/api/admin/products/bulk-features')
      .set(auth())
      .send({ productIds: [productA], featureSlugs: [], mode: 'add' });
    expect(res.status).toBe(400);
  });

  it('404s when no product id matches', async () => {
    const res = await request(app)
      .post('/api/admin/products/bulk-features')
      .set(auth())
      .send({ productIds: ['does-not-exist'], featureSlugs: [SLUG_A], mode: 'add' });
    expect(res.status).toBe(404);
  });
});

describe('bulk-features modes', () => {
  it('adds features to several products at once', async () => {
    const res = await request(app)
      .post('/api/admin/products/bulk-features')
      .set(auth())
      .send({ productIds: [productA, productB], featureSlugs: [SLUG_A, SLUG_B], mode: 'add' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updated).toBe(2);
    expect(await linkedSlugs(productA)).toEqual([SLUG_A, SLUG_B]);
    expect(await linkedSlugs(productB)).toEqual([SLUG_A, SLUG_B]);
  });

  it('is idempotent — re-adding the same features creates no duplicates', async () => {
    const res = await request(app)
      .post('/api/admin/products/bulk-features')
      .set(auth())
      .send({ productIds: [productA], featureSlugs: [SLUG_A, SLUG_B], mode: 'add' });

    expect(res.status).toBe(200);
    expect(await linkedSlugs(productA)).toEqual([SLUG_A, SLUG_B]);
  });

  it('appends a new feature after the existing ones, preserving order', async () => {
    await request(app)
      .post('/api/admin/products/bulk-features')
      .set(auth())
      .send({ productIds: [productA], featureSlugs: [SLUG_C], mode: 'add' });

    expect(await linkedSlugs(productA)).toEqual([SLUG_A, SLUG_B, SLUG_C]);
  });

  it('removes only the named features', async () => {
    await request(app)
      .post('/api/admin/products/bulk-features')
      .set(auth())
      .send({ productIds: [productA], featureSlugs: [SLUG_B], mode: 'remove' });

    expect(await linkedSlugs(productA)).toEqual([SLUG_A, SLUG_C]);
  });

  it('replace overwrites the whole set in the supplied order', async () => {
    await request(app)
      .post('/api/admin/products/bulk-features')
      .set(auth())
      .send({ productIds: [productA], featureSlugs: [SLUG_C, SLUG_A], mode: 'replace' });

    expect(await linkedSlugs(productA)).toEqual([SLUG_C, SLUG_A]);
  });

  it('replace with an empty list clears every feature', async () => {
    const res = await request(app)
      .post('/api/admin/products/bulk-features')
      .set(auth())
      .send({ productIds: [productA], featureSlugs: [], mode: 'replace' });

    expect(res.status).toBe(200);
    expect(await linkedSlugs(productA)).toEqual([]);
  });

  it('reports unknown slugs and product ids instead of dropping them silently', async () => {
    const res = await request(app)
      .post('/api/admin/products/bulk-features')
      .set(auth())
      .send({
        productIds: [productB, 'ghost-product'],
        featureSlugs: [SLUG_A, 'ghost-feature'],
        mode: 'replace',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(1);
    expect(res.body.data.productsNotFound).toEqual(['ghost-product']);
    expect(res.body.data.slugsNotFound).toEqual(['ghost-feature']);
    expect(await linkedSlugs(productB)).toEqual([SLUG_A]);
  });
});
