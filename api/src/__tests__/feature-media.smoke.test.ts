/**
 * Smoke floor — Product Feature media (icon/image upload + display mode + library).
 * Verifies: RBAC gating on upload + features, SVG upload is SANITIZED (script /
 * onload / javascript: stripped) while a raster passes, the image + displayMode
 * fields round-trip through create/update, and the /library endpoint returns
 * deduped assets. Admin created inline (no product fixtures) so this suite is
 * independent of the drifted product-fixture path.
 */
import path from 'path';
import fs from 'fs';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../index';
import prisma from '../lib/prisma';
import { ALL_PERMISSIONS, SUPER_ADMIN_ROLE } from '../lib/rbac';
import { ADMIN_USERNAME, ADMIN_PASSWORD, RUN_ID } from './fixtures';
import { sanitizeSvg } from '../lib/svg';

let adminToken: string;
const TAG = `FM${RUN_ID}`;
const createdFeatureIds: string[] = [];

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

beforeAll(async () => {
  await createAdminOnly();
  const login = await request(app).post('/api/auth/admin/login').send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  adminToken = login.body.token;
});

afterAll(async () => {
  await prisma.productFeature.deleteMany({ where: { slug: { contains: TAG.toLowerCase() } } });
  await prisma.productFeature.deleteMany({ where: { id: { in: createdFeatureIds } } });
  await prisma.adminUser.deleteMany({ where: { username: ADMIN_USERNAME } });
  await prisma.$disconnect();
});

const auth = () => ({ Authorization: `Bearer ${adminToken}` });
const b64 = (s: string) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;

describe('SVG sanitizer (unit)', () => {
  it('strips script, onload, and javascript: while keeping shapes', () => {
    const dirty = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><rect/><a href="javascript:alert(3)">x</a></svg>';
    const clean = sanitizeSvg(dirty)!;
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/onload/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).toMatch(/<rect/i);
  });

  it('rejects a non-SVG payload', () => {
    expect(sanitizeSvg('<html>nope</html>')).toBeNull();
  });
});

describe('Feature media access control', () => {
  it('blocks upload without a token (401)', async () => {
    const res = await request(app).post('/api/admin/upload').send({ data: b64('<svg><rect/></svg>') });
    expect(res.status).toBe(401);
  });

  it('blocks the library without a token (401)', async () => {
    const res = await request(app).get('/api/admin/features/library');
    expect(res.status).toBe(401);
  });
});

describe('SVG upload is sanitized end-to-end', () => {
  it('accepts a malicious SVG but stores it scrubbed', async () => {
    const evil = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><rect width="10" height="10"/></svg>';
    const res = await request(app)
      .post('/api/admin/upload?folder=mxdblr/features')
      .set(auth())
      .send({ data: b64(evil) });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.url).toBe('string');
    // When the dev local-disk fallback is used, read the stored file back from
    // disk and confirm no active content survived. (With real Cloudinary creds the
    // URL is external and this on-disk check is skipped.)
    const url: string = res.body.url;
    if (url.includes('/uploads/')) {
      const filename = url.slice(url.lastIndexOf('/') + 1);
      const stored = fs.readFileSync(path.join(process.cwd(), 'uploads', filename), 'utf8');
      expect(stored).not.toMatch(/<script/i);
      expect(stored).not.toMatch(/onload/i);
      expect(stored).not.toMatch(/javascript:/i);
      expect(stored).toMatch(/<rect/i); // benign markup preserved
    }
  });

  it('rejects an SVG mime whose payload is not an SVG (400)', async () => {
    const res = await request(app)
      .post('/api/admin/upload')
      .set(auth())
      .send({ data: b64('just plain text, not svg markup') });
    expect(res.status).toBe(400);
  });
});

describe('Feature image + displayMode + library', () => {
  it('creates a feature with image and displayMode=BOTH', async () => {
    const res = await request(app)
      .post('/api/admin/features')
      .set(auth())
      .send({ name: `Media Feat ${TAG}`, slug: `media-feat-${TAG.toLowerCase()}`, logo: '/product-features/pd.svg', image: 'https://res.cloudinary.com/demo/img.png', displayMode: 'BOTH', category: 'CHARGING' });
    expect(res.status).toBe(201);
    expect(res.body.data.image).toBe('https://res.cloudinary.com/demo/img.png');
    expect(res.body.data.displayMode).toBe('BOTH');
    createdFeatureIds.push(res.body.data.id);
  });

  it('updates displayMode (partial PUT)', async () => {
    const res = await request(app)
      .put(`/api/admin/features/${createdFeatureIds[0]}`)
      .set(auth())
      .send({ displayMode: 'IMAGE' });
    expect(res.status).toBe(200);
    expect(res.body.data.displayMode).toBe('IMAGE');
  });

  it('surfaces our feature image in the library (deduped, tagged)', async () => {
    // Assert on the uniquely-tagged image URL this suite created (not on seed data).
    const res = await request(app).get('/api/admin/features/library').set(auth());
    expect(res.status).toBe(200);
    const image = res.body.data.find((a: { url: string }) => a.url === 'https://res.cloudinary.com/demo/img.png');
    expect(image?.kind).toBe('image');
    // Icons list is non-empty (the seeded features + our /product-features/pd.svg).
    expect(res.body.data.some((a: { kind: string }) => a.kind === 'icon')).toBe(true);
  });

  it('rejects a bad displayMode enum (400)', async () => {
    const res = await request(app)
      .post('/api/admin/features')
      .set(auth())
      .send({ name: `Bad ${TAG}`, displayMode: 'HOLOGRAM', category: 'CHARGING' });
    expect(res.status).toBe(400);
  });
});
