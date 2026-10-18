/**
 * Smoke floor — compatible handset brands on products.
 *
 * The admin "Compatible Brand" filter used to compare Brands-list entries
 * ("For Apple") against Product.brand, the manufacturer ("MXD"), so it never
 * matched. Compatibility is now its own relation (+ fitsAllBrands for universal
 * accessories), and ?compatibleWith=<slug> filters on it.
 */
import request from 'supertest';
import app from '../index';
import prisma from '../lib/prisma';
import { generateAdminToken } from '../middleware/auth';
import { createFixtures, cleanupFixtures, SmokeFixtures, RUN_ID, SKU_PREFIX } from './fixtures';

let fx: SmokeFixtures;
let token: string;
let appleId: string;
let samsungId: string;

const appleSlug = `test-smoke-apple-${RUN_ID}`;
const samsungSlug = `test-smoke-samsung-${RUN_ID}`;

beforeAll(async () => {
  fx = await createFixtures();
  token = generateAdminToken(fx.adminId, 'smoke_super');
  appleId = (await prisma.brand.create({ data: { name: `For Apple ${RUN_ID}`, slug: appleSlug } })).id;
  samsungId = (await prisma.brand.create({ data: { name: `For Samsung ${RUN_ID}`, slug: samsungSlug } })).id;
  // U fits every brand; N has no compatibility set yet.
  await prisma.product.create({
    data: { name: `Smoke Universal ${RUN_ID}`, brand: 'MXD', sku: `${SKU_PREFIX}-${RUN_ID}-U`, fitsAllBrands: true },
  });
  await prisma.product.create({
    data: { name: `Smoke Unset ${RUN_ID}`, brand: 'MXD', sku: `${SKU_PREFIX}-${RUN_ID}-N` },
  });
});

afterAll(async () => {
  await cleanupFixtures(); // products first: their brand links cascade away
  await prisma.brand.deleteMany({ where: { slug: { in: [appleSlug, samsungSlug] } } });
  await prisma.$disconnect();
});

// Only this run's products, so real catalogue rows never affect the counts.
const listSkus = async (compatibleWith: string) => {
  const res = await request(app)
    .get(`/api/admin/products?search=${RUN_ID}&compatibleWith=${compatibleWith}&limit=100`)
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return (res.body.data as Array<{ sku: string }>).map((p) => p.sku.slice(-1)).sort();
};

describe('Saving compatible brands from the product form', () => {
  it('links the chosen brands, ignores unknown ids, and keeps the manufacturer', async () => {
    const res = await request(app)
      .put(`/api/admin/products/${fx.inStockProductId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fitsAllBrands: false, compatibleBrandIds: [appleId, 'no-such-brand'] });
    expect(res.status).toBe(200);
    expect(res.body.data.compatibleBrands.map((b: { id: string }) => b.id)).toEqual([appleId]);
    expect(res.body.data.brand).toBe('SMOKETEST');
  });

  it('replaces the set on the next save', async () => {
    const res = await request(app)
      .put(`/api/admin/products/${fx.inStockProductId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ compatibleBrandIds: [samsungId, appleId] });
    expect(res.body.data.compatibleBrands.map((b: { slug: string }) => b.slug).sort()).toEqual([appleSlug, samsungSlug].sort());
  });

  it('leaves the brands alone when the field is not sent', async () => {
    const res = await request(app)
      .put(`/api/admin/products/${fx.inStockProductId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ moq: 5 });
    expect(res.body.data.compatibleBrands).toHaveLength(2);
  });

  it('creates a product with compatible brands', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Smoke Created ${RUN_ID}`, brand: 'MXD', sku: `${SKU_PREFIX}-${RUN_ID}-C`, compatibleBrandIds: [samsungId] });
    expect(res.status).toBe(201);
    expect(res.body.data.compatibleBrands.map((b: { id: string }) => b.id)).toEqual([samsungId]);
    expect(res.body.data.fitsAllBrands).toBe(false);
  });
});

describe('Saving a product whose images are /uploads/ paths', () => {
  // Every imported product stores images as relative /uploads/<file> paths;
  // the form used to be rejected with "Each image must be a valid URL".
  it('accepts /uploads/ paths and https URLs', async () => {
    const res = await request(app)
      .put(`/api/admin/products/${fx.inStockProductId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ images: ['/uploads/poster-test.webp', 'https://res.cloudinary.com/demo/image.jpg'] });
    expect(res.status).toBe(200);
    expect(res.body.data.images).toEqual(['/uploads/poster-test.webp', 'https://res.cloudinary.com/demo/image.jpg']);
  });

  it('still rejects anything else', async () => {
    for (const bad of ['javascript:alert(1)', 'not a url', '/etc/passwd', '/uploads/../.env']) {
      const res = await request(app)
        .put(`/api/admin/products/${fx.inStockProductId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ images: [bad] });
      expect(res.status).toBe(400);
    }
  });
});

describe('Filtering the products list by compatible brand', () => {
  // Fixture products: A = Apple + Samsung, B = out-of-stock with nothing set,
  // C = Samsung only, U = fits all brands, N = nothing set.
  it('a brand matches its linked products plus universal ones', async () => {
    expect(await listSkus(appleSlug)).toEqual(['A', 'U']);
    expect(await listSkus(samsungSlug)).toEqual(['A', 'C', 'U']);
  });

  it('"none" finds products that still need compatibility set', async () => {
    expect(await listSkus('none')).toEqual(['B', 'N']);
  });

  it('a brand nobody links to still returns the universal products', async () => {
    expect(await listSkus('no-such-brand')).toEqual(['U']);
  });

  it('the list returns each product\'s compatible brands for the table', async () => {
    const res = await request(app)
      .get(`/api/admin/products?search=${RUN_ID}-U`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data[0]).toMatchObject({ fitsAllBrands: true, compatibleBrands: [] });
  });
});
