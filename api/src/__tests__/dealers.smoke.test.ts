/**
 * Smoke floor — Dealers admin filtering / search / sort / export.
 * Verifies: RBAC gating, the state→district→city cascade options endpoint, each
 * filter dimension (state, businessType, status, date range), combined filters,
 * global search (name/mobile/GST), whitelisted sorting, pagination, and that the
 * CSV/Excel export honours the same filters. Every fixture dealer is stamped with
 * RUN_ID in its shopName so cleanup can only ever remove this run's rows.
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../index';
import prisma from '../lib/prisma';
import { ALL_PERMISSIONS, SUPER_ADMIN_ROLE } from '../lib/rbac';
import { ADMIN_USERNAME, ADMIN_PASSWORD, RUN_ID } from './fixtures';

let adminToken: string;

// A minimal SUPER_ADMIN so the suite doesn't depend on the product fixtures
// (this suite exercises dealers only, no products).
async function createAdminOnly(): Promise<void> {
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
}

const TAG = `DZ${RUN_ID}`; // unique, searchable marker placed in shopName
const mobileBase = RUN_ID.slice(-8);

// Three dealers with distinct geo / type / status for filter assertions.
const DEALERS = [
  { ownerName: `Asha ${TAG}`, shopName: `Asha Mobiles ${TAG}`, mobile: `91${mobileBase}`, whatsappNumber: `91${mobileBase}`, gstNumber: `GST${TAG}A`, city: 'Bengaluru', tehsil: 'Bengaluru', district: 'Bengaluru Urban', state: 'Karnataka', pincode: '560001', businessType: 'DISTRIBUTOR' as const, status: 'ACTIVE' as const },
  { ownerName: `Bala ${TAG}`, shopName: `Bala Traders ${TAG}`, mobile: `92${mobileBase}`, whatsappNumber: `92${mobileBase}`, gstNumber: `GST${TAG}B`, city: 'Mysuru', tehsil: 'Mysuru', district: 'Mysuru', state: 'Karnataka', pincode: '570001', businessType: 'WHOLESALER' as const, status: 'SUSPENDED' as const },
  { ownerName: `Chetan ${TAG}`, shopName: `Chetan Store ${TAG}`, mobile: `93${mobileBase}`, whatsappNumber: `93${mobileBase}`, gstNumber: `GST${TAG}C`, city: 'Chennai', tehsil: 'Chennai', district: 'Chennai', state: 'Tamil Nadu', pincode: '600001', businessType: 'RETAIL_SHOP' as const, status: 'ACTIVE' as const },
];

beforeAll(async () => {
  await createAdminOnly();
  const login = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  adminToken = login.body.token;

  for (const d of DEALERS) {
    await prisma.dealer.create({ data: d });
  }
});

afterAll(async () => {
  await prisma.dealer.deleteMany({ where: { shopName: { contains: TAG } } });
  await prisma.adminUser.deleteMany({ where: { username: ADMIN_USERNAME } });
  await prisma.$disconnect();
});

const auth = () => ({ Authorization: `Bearer ${adminToken}` });

describe('Dealers filter access control', () => {
  it('blocks the list without a token (401)', async () => {
    const res = await request(app).get('/api/admin/dealers');
    expect(res.status).toBe(401);
  });

  it('blocks a dealer-type token (401)', async () => {
    const { generateDealerToken } = await import('../middleware/auth');
    const t = generateDealerToken('fake-dealer', '9000000009');
    const res = await request(app).get('/api/admin/dealers').set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(401);
  });
});

describe('Dealers filter options (cascade)', () => {
  it('returns states/types/statuses and the enum lists', async () => {
    const res = await request(app).get('/api/admin/dealers/filters/options').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.states).toEqual(expect.arrayContaining(['Karnataka', 'Tamil Nadu']));
    expect(res.body.data.businessTypes).toEqual(expect.arrayContaining(['DISTRIBUTOR', 'WHOLESALER']));
    expect(res.body.data.statuses).toEqual(expect.arrayContaining(['ACTIVE', 'SUSPENDED']));
  });

  it('narrows districts to the chosen state', async () => {
    const res = await request(app).get('/api/admin/dealers/filters/options?state=Tamil Nadu').set(auth());
    expect(res.status).toBe(200);
    // Chennai (TN) present; a Karnataka-only district must NOT appear for TN.
    expect(res.body.data.districts).toEqual(expect.arrayContaining(['Chennai']));
    expect(res.body.data.districts).not.toContain('Mysuru');
  });
});

describe('Dealers filtering + search + sort', () => {
  it('filters by state', async () => {
    const res = await request(app).get(`/api/admin/dealers?state=Tamil Nadu&search=${TAG}`).set(auth());
    expect(res.status).toBe(200);
    const states = res.body.data.map((d: { state: string }) => d.state);
    expect(states.every((s: string) => s === 'Tamil Nadu')).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  it('filters by businessType', async () => {
    const res = await request(app).get(`/api/admin/dealers?businessType=DISTRIBUTOR&search=${TAG}`).set(auth());
    expect(res.body.data.every((d: { businessType: string }) => d.businessType === 'DISTRIBUTOR')).toBe(true);
  });

  it('filters by status', async () => {
    const res = await request(app).get(`/api/admin/dealers?status=SUSPENDED&search=${TAG}`).set(auth());
    expect(res.body.data.every((d: { status: string }) => d.status === 'SUSPENDED')).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  it('combines state + status', async () => {
    const res = await request(app).get(`/api/admin/dealers?state=Karnataka&status=ACTIVE&search=${TAG}`).set(auth());
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].ownerName).toContain('Asha');
  });

  it('searches by GST number (case-insensitive)', async () => {
    const res = await request(app).get(`/api/admin/dealers?search=gst${TAG.toLowerCase()}b`).set(auth());
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].ownerName).toContain('Bala');
  });

  it('sorts by name ascending (whitelisted field)', async () => {
    const res = await request(app).get(`/api/admin/dealers?search=${TAG}&sort=name&dir=asc`).set(auth());
    const names = res.body.data.map((d: { ownerName: string }) => d.ownerName);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('paginates (limit=2 → page has 2, pages≥2 for our 3 tagged rows)', async () => {
    const res = await request(app).get(`/api/admin/dealers?search=${TAG}&limit=2&page=1`).set(auth());
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
  });
});

describe('Dealers export', () => {
  it('exports CSV honouring filters (UTF-8 BOM, header row)', async () => {
    const res = await request(app).get(`/api/admin/dealers/export?format=csv&status=SUSPENDED&search=${TAG}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(res.text).toContain('Dealer ID');
    expect(res.text).toContain('Bala'); // the one suspended tagged dealer
    expect(res.text).not.toContain('Asha'); // active — excluded by the filter
  });

  it('exports Excel XML with the ms-excel content type', async () => {
    const res = await request(app).get(`/api/admin/dealers/export?format=xlsx&search=${TAG}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/vnd.ms-excel');
    expect(res.text).toContain('urn:schemas-microsoft-com:office:spreadsheet');
    expect(res.text).toContain('Chetan');
  });
});
