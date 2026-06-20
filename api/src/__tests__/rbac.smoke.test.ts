/**
 * Smoke floor — RBAC enforcement.
 * Verifies /me, permission-gated routes (allow + deny), role CRUD, and the
 * anti-privilege-escalation guards on user/role management.
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../index';
import prisma from '../lib/prisma';
import { generateAdminToken } from '../middleware/auth';
import { createFixtures, cleanupFixtures, SmokeFixtures, RUN_ID } from './fixtures';

let fx: SmokeFixtures;
let superToken: string;     // SUPER_ADMIN (the smoke fixture admin)
let workerToken: string;    // SHOP_WORKER
let adminTierToken: string; // ADMIN
let workerId = '';
let adminTierId = '';

const CUSTOM_ROLE = `smoke_role_${RUN_ID}`;
const ESC_USER = `smoke_admin_esc_${RUN_ID}`;

async function createUserWithRole(username: string, roleName: string): Promise<string> {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) throw new Error(`Role ${roleName} not found — run migrations/seed`);
  const u = await prisma.adminUser.create({
    data: { username, passwordHash: await bcrypt.hash('test-pass-123', 10), roleId: role.id },
  });
  return u.id;
}

beforeAll(async () => {
  fx = await createFixtures(); // creates a SUPER_ADMIN smoke admin
  superToken = generateAdminToken(fx.adminId, 'smoke_super');
  workerId = await createUserWithRole(`smoke_admin_worker_${RUN_ID}`, 'SHOP_WORKER');
  workerToken = generateAdminToken(workerId, 'smoke_worker');
  adminTierId = await createUserWithRole(`smoke_admin_at_${RUN_ID}`, 'ADMIN');
  adminTierToken = generateAdminToken(adminTierId, 'smoke_admintier');
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actorId: { in: [fx.adminId, workerId, adminTierId] } } });
  await prisma.role.deleteMany({ where: { name: CUSTOM_ROLE } });
  await cleanupFixtures(); // removes all smoke_admin_* users (incl. worker, admintier, esc user)
  await prisma.$disconnect();
});

describe('GET /api/admin/me', () => {
  it('returns the full permission set for a Super Admin', async () => {
    const res = await request(app).get('/api/admin/me').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.role.name).toBe('SUPER_ADMIN');
    expect(res.body.data.permissions).toContain('MANAGE_ROLES');
    expect(res.body.data.permissions.length).toBe(12);
  });

  it('returns a restricted set for a Shop Worker', async () => {
    const res = await request(app).get('/api/admin/me').set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.role.name).toBe('SHOP_WORKER');
    expect(res.body.data.permissions.sort()).toEqual(['CREATE_ORDERS', 'MANAGE_INVENTORY', 'VIEW_DASHBOARD']);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/admin/me');
    expect(res.status).toBe(401);
  });
});

describe('Permission enforcement (Shop Worker)', () => {
  it('ALLOWS a route the role holds (MANAGE_INVENTORY → stock summary)', async () => {
    const res = await request(app).get('/api/admin/products/stock-summary').set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(200);
  });

  it('DENIES customers (lacks MANAGE_CUSTOMERS) with 403', async () => {
    const res = await request(app).get('/api/admin/dealers').set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  it('DENIES role management (lacks MANAGE_ROLES) with 403', async () => {
    const res = await request(app).get('/api/admin/roles').set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  it('DENIES product creation (lacks MANAGE_PRODUCTS) with 403', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ name: 'x', brand: 'y', sku: `RBAC-DENY-${RUN_ID}` });
    expect(res.status).toBe(403);
  });

  it('DENIES creating users (lacks MANAGE_STAFF) with 403', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ username: `nope_${RUN_ID}`, password: 'password123', roleId: 'role_shop_worker' });
    expect(res.status).toBe(403);
  });
});

describe('Role management (Super Admin)', () => {
  let customRoleId = '';

  it('lists roles including the four system roles', async () => {
    const res = await request(app).get('/api/admin/roles').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    const names = res.body.data.map((r: { name: string }) => r.name);
    expect(names).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SHOP_WORKER']));
  });

  it('creates a custom role', async () => {
    const res = await request(app)
      .post('/api/admin/roles')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ name: CUSTOM_ROLE, description: 'smoke', permissions: ['VIEW_DASHBOARD', 'MANAGE_INVENTORY'] });
    expect(res.status).toBe(201);
    expect(res.body.data.permissions.sort()).toEqual(['MANAGE_INVENTORY', 'VIEW_DASHBOARD']);
    customRoleId = res.body.data.id;
  });

  it('updates the custom role permissions', async () => {
    const res = await request(app)
      .patch(`/api/admin/roles/${customRoleId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ permissions: ['VIEW_DASHBOARD'] });
    expect(res.status).toBe(200);
    expect(res.body.data.permissions).toEqual(['VIEW_DASHBOARD']);
  });

  it('writes an audit log entry for the change', async () => {
    const res = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    const actions = res.body.data.map((l: { action: string }) => l.action);
    expect(actions).toContain('ROLE_CREATED');
  });

  it('deletes the custom role', async () => {
    const res = await request(app).delete(`/api/admin/roles/${customRoleId}`).set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  it('refuses to delete a system role', async () => {
    const res = await request(app).delete('/api/admin/roles/role_manager').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(400);
  });
});

describe('Anti-privilege-escalation guards', () => {
  it('lets an Admin create a Shop Worker (lower rank)', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminTierToken}`)
      .send({ username: ESC_USER, password: 'password123', roleId: 'role_shop_worker' });
    expect(res.status).toBe(201);
  });

  it('blocks an Admin from creating another Admin (admin-tier needs MANAGE_ADMINS)', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminTierToken}`)
      .send({ username: `smoke_admin_peer_${RUN_ID}`, password: 'password123', roleId: 'role_admin' });
    expect(res.status).toBe(403);
  });

  it('blocks a user from modifying their own role/status', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${fx.adminId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ active: false });
    expect(res.status).toBe(400);
  });
});
