/**
 * Smoke floor — OTP auth + registration + geo gate.
 * Uses the dev-bypass OTP (000000, enabled via ENABLE_OTP_BYPASS in setup-env)
 * so no SMS provider is needed. All DB writes are cleaned up in afterAll.
 */
import request from 'supertest';
import app from '../index';
import prisma from '../lib/prisma';
import { DEALER_MOBILE, cleanupFixtures } from './fixtures';

const BYPASS_OTP = '000000';

const registrationPayload = {
  mobile: DEALER_MOBILE,
  ownerName: 'Smoke Tester',
  shopName: 'Smoke Test Traders',
  whatsappNumber: DEALER_MOBILE,
  city: 'Bengaluru',
  tehsil: 'Bengaluru North',
  district: 'Bengaluru Urban',
  state: 'Karnataka',
  country: 'India',
  pincode: '560001',
  businessType: 'RETAIL_SHOP',
};

afterAll(async () => {
  await cleanupFixtures();
  await prisma.$disconnect();
});

describe('OTP auth flow', () => {
  it('rejects an invalid mobile number on send-otp', async () => {
    const res = await request(app).post('/api/auth/send-otp').send({ mobile: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('accepts a valid mobile number on send-otp (mock SMS path)', async () => {
    const res = await request(app).post('/api/auth/send-otp').send({ mobile: DEALER_MOBILE });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('stores the OTP hashed, never in plaintext', async () => {
    const record = await prisma.otpCode.findFirst({
      where: { mobile: DEALER_MOBILE, used: false },
      orderBy: { createdAt: 'desc' },
    });
    expect(record).not.toBeNull();
    expect(record!.code).toMatch(/^\$2[aby]\$/); // bcrypt hash signature
  });

  it('rejects a wrong OTP', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ mobile: DEALER_MOBILE, otp: '999999' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or expired/i);
  });

  it('verifies the bypass OTP and flags an unregistered dealer as new', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ mobile: DEALER_MOBILE, otp: BYPASS_OTP });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.newDealer).toBe(true);
  });
});

describe('Registration + geo gate', () => {
  it('blocks registration from a disallowed state (server-side geo control)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...registrationPayload, state: 'Maharashtra' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('registers a dealer from an allowed state and returns a JWT', async () => {
    const res = await request(app).post('/api/auth/register').send(registrationPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.dealer.status).toBe('ACTIVE');
  });

  it('rejects duplicate registration with 409', async () => {
    const res = await request(app).post('/api/auth/register').send(registrationPayload);
    expect(res.status).toBe(409);
  });

  it('logs in an existing dealer via OTP and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ mobile: DEALER_MOBILE, otp: BYPASS_OTP });
    expect(res.status).toBe(200);
    expect(res.body.newDealer).toBe(false);
    expect(typeof res.body.token).toBe('string');
  });
});
