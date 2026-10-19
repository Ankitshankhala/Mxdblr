/**
 * Smoke floor — dealer OTP auth, registration, the httpOnly session cookie and
 * the geo gate. Uses the dev-bypass OTP (000000, enabled via ENABLE_OTP_BYPASS in
 * setup-env) where the code itself doesn't matter, and inserts known codes where
 * it does. No WhatsApp provider is needed. All DB writes are cleaned up in afterAll.
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../index';
import prisma from '../lib/prisma';
import * as msg91 from '../lib/msg91';
import { DEALER_MOBILE, RUN_ID, cleanupFixtures } from './fixtures';

const BYPASS_OTP = '000000';
const KNOWN_OTP = '123456';
// Extra numbers for the limit and lock tests, each with its own codes.
const CAP_MOBILE = `8${RUN_ID.slice(-9)}`;
const FAIL_MOBILE = `7${RUN_ID.slice(-9)}`;
const LOCK_MOBILE = `6${RUN_ID.slice(-9)}`;

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

async function insertCode(mobile: string, code: string, extra: { used?: boolean; createdAt?: Date } = {}) {
  return prisma.otpCode.create({
    data: { mobile, code: await bcrypt.hash(code, 10), expiresAt: new Date(Date.now() + 10 * 60 * 1000), ...extra },
  });
}

/** The mxd_session Set-Cookie line, if the response set one. */
function sessionCookie(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith('mxd_session='));
}

/** Runs fn with the OTP bypass off, so registration needs a real verified code. */
async function withoutBypass<T>(fn: () => Promise<T>): Promise<T> {
  process.env.ENABLE_OTP_BYPASS = 'false';
  try {
    return await fn();
  } finally {
    process.env.ENABLE_OTP_BYPASS = 'true';
  }
}

afterAll(async () => {
  await prisma.otpCode.deleteMany({ where: { mobile: { in: [CAP_MOBILE, FAIL_MOBILE, LOCK_MOBILE] } } });
  await cleanupFixtures();
  await prisma.$disconnect();
});

// The send-otp IP limiter allows 5 requests per 10 minutes, and this block uses
// exactly 6 so the last one can check the limiter's own answer.
describe('send-otp', () => {
  it('rejects an invalid mobile number with invalid_phone', async () => {
    const res = await request(app).post('/api/auth/send-otp').send({ mobile: '12345' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'invalid_phone' });
  });

  it('accepts a valid number and says how long the code lasts and when to resend', async () => {
    const res = await request(app).post('/api/auth/send-otp').send({ mobile: DEALER_MOBILE });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, expiresIn: 600, resendIn: 30 });
  });

  it('stores the OTP hashed, never in plaintext', async () => {
    const record = await prisma.otpCode.findFirst({
      where: { mobile: DEALER_MOBILE, used: false },
      orderBy: { createdAt: 'desc' },
    });
    expect(record).not.toBeNull();
    expect(record!.code).toMatch(/^\$2[aby]\$/); // bcrypt hash signature
  });

  it('refuses a second code within 30 seconds, with the wait', async () => {
    const res = await request(app).post('/api/auth/send-otp').send({ mobile: DEALER_MOBILE });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('wait_before_resend');
    expect(res.body.retryAfter).toBeGreaterThan(0);
    expect(res.body.retryAfter).toBeLessThanOrEqual(30);
  });

  it('caps codes per number per hour (too_many_otps)', async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    for (let i = 0; i < 5; i++) await insertCode(CAP_MOBILE, KNOWN_OTP, { used: true, createdAt: twoMinutesAgo });
    const res = await request(app).post('/api/auth/send-otp').send({ mobile: CAP_MOBILE });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('too_many_otps');
    expect(res.body.retryAfter).toBeGreaterThan(3000); // about 58 minutes
  });

  it('reports delivery_failed and keeps no code when WhatsApp delivery fails', async () => {
    const spy = jest.spyOn(msg91, 'sendOtp').mockResolvedValueOnce(false);
    const res = await request(app).post('/api/auth/send-otp').send({ mobile: FAIL_MOBILE });
    spy.mockRestore();
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('delivery_failed');
    expect(await prisma.otpCode.count({ where: { mobile: FAIL_MOBILE } })).toBe(0);
  });

  it('answers the per-IP limit with too_many_requests and retryAfter', async () => {
    const res = await request(app).post('/api/auth/send-otp').send({ mobile: FAIL_MOBILE });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('too_many_requests');
    expect(res.body.retryAfter).toBeGreaterThan(0);
  });
});

describe('verify-otp', () => {
  it('rejects a wrong code with the attempts left', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({ mobile: DEALER_MOBILE, otp: '999999' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'invalid_otp', attemptsLeft: 4 });
  });

  it('rejects a malformed code with invalid_input', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({ mobile: DEALER_MOBILE, otp: '12ab' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_input');
  });

  it('locks a code after 5 wrong guesses, then reports it expired or missing', async () => {
    await insertCode(LOCK_MOBILE, KNOWN_OTP);
    for (const left of [4, 3, 2, 1]) {
      const res = await request(app).post('/api/auth/verify-otp').send({ mobile: LOCK_MOBILE, otp: '999999' });
      expect(res.body).toMatchObject({ error: 'invalid_otp', attemptsLeft: left });
    }
    const locked = await request(app).post('/api/auth/verify-otp').send({ mobile: LOCK_MOBILE, otp: '999999' });
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe('too_many_attempts');

    // Even the right code no longer works.
    const after = await request(app).post('/api/auth/verify-otp').send({ mobile: LOCK_MOBILE, otp: KNOWN_OTP });
    expect(after.status).toBe(400);
    expect(after.body.error).toBe('otp_expired_or_missing');
  });
});

describe('Registration + session cookie', () => {
  let cookie = '';
  let dealerId = '';

  it('blocks registration from a disallowed state (server-side geo control)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...registrationPayload, state: 'Maharashtra' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('refuses registration when no code was entered correctly (superseded codes do not count)', async () => {
    const res = await withoutBypass(() => request(app).post('/api/auth/register').send(registrationPayload));
    expect(res.status).toBe(401);
  });

  it('verifies a real code, flags the new number and sets no session yet', async () => {
    await insertCode(DEALER_MOBILE, KNOWN_OTP);
    const res = await request(app).post('/api/auth/verify-otp').send({ mobile: DEALER_MOBILE, otp: KNOWN_OTP });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, newDealer: true });
    expect(sessionCookie(res)).toBeUndefined();
    const record = await prisma.otpCode.findFirst({ where: { mobile: DEALER_MOBILE, verifiedAt: { not: null } } });
    expect(record?.used).toBe(true);
  });

  it('registers the verified number and signs in with an httpOnly cookie, not a body token', async () => {
    const res = await withoutBypass(() => request(app).post('/api/auth/register').send(registrationPayload));
    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();
    expect(res.body.user.phone).toBe(DEALER_MOBILE);
    expect(res.body.dealer.status).toBe('ACTIVE');
    const set = sessionCookie(res);
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=Lax/i);
    expect(set).toMatch(/Path=\//);
  });

  it('rejects duplicate registration with 409', async () => {
    const res = await request(app).post('/api/auth/register').send(registrationPayload);
    expect(res.status).toBe(409);
  });

  it('logs in an existing dealer via OTP with the session cookie', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({ mobile: DEALER_MOBILE, otp: BYPASS_OTP });
    expect(res.status).toBe(200);
    expect(res.body.newDealer).toBe(false);
    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toMatchObject({ phone: DEALER_MOBILE });
    const set = sessionCookie(res);
    expect(set).toBeDefined();
    cookie = set!.split(';')[0];
    dealerId = res.body.user.id;
  });

  it('GET /me returns the dealer for the cookie', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, phone: DEALER_MOBILE });
    expect(typeof res.body.sub).toBe('string');
  });

  it('dealer routes accept the cookie in place of a Bearer header', async () => {
    const res = await request(app).get('/api/cart').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  it('keeps a dealer signed in for 90 days', async () => {
    const { iat, exp } = jwt.decode(cookie.split('=')[1]) as { iat: number; exp: number };
    expect(exp - iat).toBe(90 * 24 * 60 * 60);
  });

  it('GET /me leaves a fresh session cookie alone', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toBeUndefined();
  });

  it('GET /me renews a session cookie older than a day for another 90 days', async () => {
    const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;
    const old = jwt.sign(
      { dealerId: dealerId, mobile: DEALER_MOBILE, type: 'dealer', iat: twoDaysAgo },
      process.env.JWT_SECRET!,
      { expiresIn: 90 * 24 * 60 * 60 }
    );
    const res = await request(app).get('/api/auth/me').set('Cookie', `mxd_session=${old}`);
    expect(res.status).toBe(200);
    const renewed = sessionCookie(res);
    expect(renewed).toMatch(/HttpOnly/i);
    const { iat, exp } = jwt.decode(renewed!.split(';')[0].split('=')[1]) as { iat: number; exp: number };
    expect(iat).toBeGreaterThan(twoDaysAgo + 24 * 60 * 60);
    expect(exp - iat).toBe(90 * 24 * 60 * 60);
  });

  it('GET /me is 401 without a session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('a bad session cookie gets a 401 and is cleared', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'mxd_session=not-a-token');
    expect(res.status).toBe(401);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('logout clears the session cookie', async () => {
    const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

/** The mxd_device Set-Cookie line, if the response set one. */
function deviceCookie(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith('mxd_device='));
}

describe('Remembered phone (number-only login)', () => {
  let device = '';
  const OTHER_MOBILE = `9${String(Number(RUN_ID.slice(-9)) + 1).padStart(9, '0').slice(-9)}`;

  it('every sign-in also remembers the phone for a year', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({ mobile: DEALER_MOBILE, otp: BYPASS_OTP });
    expect(res.status).toBe(200);
    const set = deviceCookie(res);
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=Lax/i);
    device = set!.split(';')[0];
    const { iat, exp } = jwt.decode(device.split('=')[1]) as { iat: number; exp: number };
    expect(exp - iat).toBe(365 * 24 * 60 * 60);
  });

  it('GET /device tells the login page which number this phone remembers', async () => {
    const remembered = await request(app).get('/api/auth/device').set('Cookie', device);
    expect(remembered.body).toEqual({ success: true, mobile: DEALER_MOBILE });
    const unknown = await request(app).get('/api/auth/device');
    expect(unknown.body).toEqual({ success: true, mobile: null });
  });

  it('logout ends the session but keeps the phone remembered', async () => {
    const res = await request(app).post('/api/auth/logout').set('Cookie', device);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(deviceCookie(res)).toBeUndefined();
  });

  it('signs in with just the number on the remembered phone', async () => {
    const res = await request(app).post('/api/auth/device-login').set('Cookie', device).send({ mobile: DEALER_MOBILE });
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe(DEALER_MOBILE);
    expect(res.body.token).toBeUndefined();
    expect(sessionCookie(res)).toMatch(/HttpOnly/i);
  });

  it('asks for a code for another number on that phone', async () => {
    const res = await request(app).post('/api/auth/device-login').set('Cookie', device).send({ mobile: OTHER_MOBILE });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('otp_required');
  });

  it('asks for a code on a phone that never verified (knowing the number is not enough)', async () => {
    const res = await request(app).post('/api/auth/device-login').send({ mobile: DEALER_MOBILE });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('otp_required');
  });

  it('a session token cannot stand in for the device cookie', async () => {
    const login = await request(app).post('/api/auth/verify-otp').send({ mobile: DEALER_MOBILE, otp: BYPASS_OTP });
    const sessionToken = sessionCookie(login)!.split(';')[0].split('=')[1];
    const res = await request(app)
      .post('/api/auth/device-login')
      .set('Cookie', `mxd_device=${sessionToken}`)
      .send({ mobile: DEALER_MOBILE });
    expect(res.status).toBe(401);
  });

  it('an admin block forgets remembered phones', async () => {
    await new Promise((r) => setTimeout(r, 1100)); // revocation must be later than the token's issue second
    await prisma.dealer.update({ where: { mobile: DEALER_MOBILE }, data: { lastRevokedAt: new Date() } });
    const res = await request(app).post('/api/auth/device-login').set('Cookie', device).send({ mobile: DEALER_MOBILE });
    expect(res.status).toBe(401);
    const check = await request(app).get('/api/auth/device').set('Cookie', device);
    expect(check.body.mobile).toBeNull();
    expect(deviceCookie(check)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
