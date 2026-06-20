/**
 * Shared, self-cleaning test fixtures for the smoke suites.
 *
 * createFixtures seeds an admin (with the SUPER_ADMIN role + all permissions),
 * a dealer, and test products; cleanupFixtures removes them in afterAll. Every
 * row is stamped with a per-run marker (RUN_ID / SKU_PREFIX) so cleanup can only
 * ever delete this run's data — never real records. Keeps the suite runnable
 * against a real Postgres with zero leftover rows.
 */
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { ALL_PERMISSIONS, SUPER_ADMIN_ROLE } from '../lib/rbac';

// Every fixture row carries this marker so cleanup can never touch real data.
export const RUN_ID = `${Date.now()}`;
export const SKU_PREFIX = 'TEST-SMOKE';

export const ADMIN_USERNAME = `smoke_admin_${RUN_ID}`;
export const ADMIN_PASSWORD = `smoke-pass-${RUN_ID}`;

// Valid Indian mobile (starts 6-9, 10 digits), unique per run via timestamp.
export const DEALER_MOBILE = `9${RUN_ID.slice(-9)}`;

export interface SmokeFixtures {
  adminId: string;
  categoryId: string;
  inStockProductId: string;
  outOfStockProductId: string;
}

export async function createFixtures(): Promise<SmokeFixtures> {
  // Ensure the SUPER_ADMIN role exists (normally seeded) with all permissions, so the
  // smoke admin can exercise every admin route under the new RBAC enforcement.
  const superRole = await prisma.role.upsert({
    where: { name: SUPER_ADMIN_ROLE },
    update: {},
    create: { name: SUPER_ADMIN_ROLE, description: 'Full access', isSystem: true, rank: 0 },
  });
  await prisma.rolePermission.createMany({
    data: ALL_PERMISSIONS.map((permission) => ({ roleId: superRole.id, permission })),
    skipDuplicates: true,
  });

  const admin = await prisma.adminUser.create({
    data: {
      username: ADMIN_USERNAME,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      roleId: superRole.id,
    },
  });

  const category = await prisma.category.create({
    data: { name: `Smoke Test Category ${RUN_ID}`, slug: `test-smoke-${RUN_ID}`, displayOrder: 999 },
  });

  const inStock = await prisma.product.create({
    data: {
      name: `Smoke Test Earphone ${RUN_ID}`,
      brand: 'SMOKETEST',
      sku: `${SKU_PREFIX}-${RUN_ID}-A`,
      moq: 5,
      stockStatus: 'IN_STOCK',
      stockQty: 100,
      categoryId: category.id,
    },
  });

  const outOfStock = await prisma.product.create({
    data: {
      name: `Smoke Test Charger ${RUN_ID}`,
      brand: 'SMOKETEST',
      sku: `${SKU_PREFIX}-${RUN_ID}-B`,
      moq: 1,
      stockStatus: 'OUT_OF_STOCK',
      stockQty: 0,
      categoryId: category.id,
    },
  });

  return {
    adminId: admin.id,
    categoryId: category.id,
    inStockProductId: inStock.id,
    outOfStockProductId: outOfStock.id,
  };
}

export async function cleanupFixtures(): Promise<void> {
  // FK order: cart items / inquiries / otp codes → dealer → products → category → admin
  const dealers = await prisma.dealer.findMany({ where: { mobile: DEALER_MOBILE }, select: { id: true } });
  const dealerIds = dealers.map((d) => d.id);

  await prisma.cartItem.deleteMany({ where: { dealerId: { in: dealerIds } } });
  await prisma.inquiryLog.deleteMany({ where: { dealerId: { in: dealerIds } } });
  await prisma.otpCode.deleteMany({ where: { mobile: DEALER_MOBILE } });
  await prisma.dealer.deleteMany({ where: { id: { in: dealerIds } } });

  // ProductAttribute/CompatibilityTag cascade on product delete
  await prisma.cartItem.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: 'test-smoke-' } } });
  await prisma.adminUser.deleteMany({ where: { username: { startsWith: 'smoke_admin_' } } });
}
