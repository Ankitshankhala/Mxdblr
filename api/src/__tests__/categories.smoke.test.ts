/**
 * Smoke floor — the public category list only shows categories dealers can
 * actually browse: at least one visible product, in themselves or a
 * sub-category. Empty categories stay visible to admins.
 */
import request from 'supertest';
import app from '../index';
import prisma from '../lib/prisma';
import { generateAdminToken } from '../middleware/auth';
import { createFixtures, cleanupFixtures, SmokeFixtures, RUN_ID, SKU_PREFIX } from './fixtures';

let fx: SmokeFixtures;
const EMPTY = `test-smoke-empty-${RUN_ID}`;
const PARENT = `test-smoke-parent-${RUN_ID}`;
const CHILD = `test-smoke-child-${RUN_ID}`;
const HIDDEN_ONLY = `test-smoke-hidden-${RUN_ID}`;

beforeAll(async () => {
  fx = await createFixtures(); // its category holds two visible products
  await prisma.category.create({ data: { name: `Smoke Empty ${RUN_ID}`, slug: EMPTY } });
  const parent = await prisma.category.create({ data: { name: `Smoke Parent ${RUN_ID}`, slug: PARENT } });
  const child = await prisma.category.create({ data: { name: `Smoke Child ${RUN_ID}`, slug: CHILD, parentId: parent.id } });
  await prisma.product.create({ data: { name: `Smoke In Child ${RUN_ID}`, brand: 'MXD', sku: `${SKU_PREFIX}-${RUN_ID}-CH`, categoryId: child.id } });
  const hidden = await prisma.category.create({ data: { name: `Smoke Hidden Only ${RUN_ID}`, slug: HIDDEN_ONLY } });
  await prisma.product.create({ data: { name: `Smoke Hidden ${RUN_ID}`, brand: 'MXD', sku: `${SKU_PREFIX}-${RUN_ID}-HD`, categoryId: hidden.id, active: false } });
});

afterAll(async () => {
  await cleanupFixtures(); // products, then every test-smoke-* category
  await prisma.$disconnect();
});

type Node = { slug: string; productCount: number; children: Node[] };
const flatten = (nodes: Node[]): Node[] => nodes.flatMap((n) => [n, ...flatten(n.children)]);

describe('GET /api/categories', () => {
  it('lists categories with visible products and the parents of such categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    const slugs = flatten(res.body.data).map((n) => n.slug);
    expect(slugs).toEqual(expect.arrayContaining([`test-smoke-${RUN_ID}`, PARENT, CHILD]));
  });

  it('leaves out empty categories and ones holding only hidden products', async () => {
    const res = await request(app).get('/api/categories');
    const slugs = flatten(res.body.data).map((n) => n.slug);
    expect(slugs).not.toContain(EMPTY);
    expect(slugs).not.toContain(HIDDEN_ONLY);
  });

  it('counts only visible products', async () => {
    const res = await request(app).get('/api/categories');
    const own = flatten(res.body.data).find((n) => n.slug === `test-smoke-${RUN_ID}`);
    expect(own?.productCount).toBe(2);
  });

  it('admins still see the empty categories', async () => {
    const res = await request(app)
      .get('/api/admin/categories')
      .set('Authorization', `Bearer ${generateAdminToken(fx.adminId, 'smoke_super')}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain(EMPTY);
  });
});
