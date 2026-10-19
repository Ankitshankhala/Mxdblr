/**
 * Authentication routes — dealer OTP login/registration + admin login.
 * Mounted at /api/auth (geo-gated in index.ts).
 *
 * Endpoints: POST /send-otp, POST /verify-otp (rate-limited brute-force guards),
 * POST /register (creates a dealer; state validated server-side), GET /me (the
 * signed-in dealer), GET /device + POST /device-login (number-only login on a
 * remembered phone), POST /logout, POST /admin/login (username + bcrypt password
 * → admin JWT). Login codes are hashed at rest and sent on WhatsApp via MSG91
 * (lib/msg91.ts). The dealer JWT goes into the httpOnly session cookie
 * (lib/session.ts), never the response body. Inputs validated with zod.
 *
 * A WhatsApp code is needed once per phone: every sign-in also remembers the
 * phone (mxd_device cookie, kept on logout), and on that phone the registered
 * number alone signs the dealer back in. Any other phone still needs a code, so
 * knowing a dealer's number is not enough. An admin block (lastRevokedAt) also
 * forgets every remembered phone.
 *
 * Dealer-facing failures carry a stable `error` code (invalid_phone,
 * wait_before_resend, too_many_otps, delivery_failed, invalid_input, invalid_otp,
 * otp_expired_or_missing, too_many_attempts) plus `retryAfter` / `attemptsLeft`
 * where they apply, so the login screen can say exactly what happened.
 */
import { Router, Request, Response } from 'express';
import { BusinessType } from '@prisma/client';
import { z } from 'zod';
// npm install bcryptjs @types/bcryptjs
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import {
  generateDealerToken,
  generateDeviceToken,
  readDealerToken,
  requireDealerAuth,
  verifyDeviceToken,
} from '../middleware/auth';
import { sendOtp } from '../lib/msg91';
import {
  clearDeviceCookie,
  clearSessionCookie,
  readDeviceCookie,
  setDeviceCookie,
  setSessionCookie,
} from '../lib/session';
import { otpRateLimit, otpVerifyRateLimit, adminLoginRateLimit } from '../middleware/rateLimit';
import prisma from '../lib/prisma';

const router = Router();

/** How long a login code works. */
const OTP_TTL_SECONDS = 10 * 60;
/** Minimum gap between two codes for the same number. */
const RESEND_AFTER_SECONDS = 30;
/** Codes per number per hour, admin-issued codes included. */
const MAX_CODES_PER_HOUR = 5;
/** Wrong guesses before a code locks. */
const MAX_ATTEMPTS = 5;
/** A session cookie older than this is swapped for a fresh one on the next visit. */
const RENEW_SESSION_AFTER_MS = 24 * 60 * 60 * 1000;
/** A verified new number has this long to finish the registration form. */
const REGISTER_WINDOW_MS = 30 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

function fail(
  res: Response,
  status: number,
  error: string,
  message: string,
  extra: Record<string, number> = {}
): void {
  res.status(status).json({ success: false, error, message, ...extra });
}

function dealerSummary(dealer: { id: string; ownerName: string; shopName: string; mobile: string; status: string }) {
  return { id: dealer.id, ownerName: dealer.ownerName, shopName: dealer.shopName, mobile: dealer.mobile, status: dealer.status };
}

type DealerRow = { id: string; ownerName: string; shopName: string; mobile: string; status: string };

/** Signs the dealer in on this browser and remembers the phone for number-only login. */
function startSession(req: Request, res: Response, dealer: DealerRow): void {
  setSessionCookie(req, res, generateDealerToken(dealer.id, dealer.mobile));
  setDeviceCookie(req, res, generateDeviceToken(dealer.id, dealer.mobile));
}

/**
 * The dealer this browser remembers, if that still holds: a valid device cookie
 * for an account that still has that number, is not blocked or rejected, and
 * has not been revoked by an admin since the phone was remembered.
 */
async function rememberedDealer(req: Request) {
  const token = readDeviceCookie(req);
  const payload = token ? verifyDeviceToken(token) : null;
  if (!payload) return null;
  const dealer = await prisma.dealer.findUnique({
    where: { id: payload.dealerId },
    select: { id: true, ownerName: true, shopName: true, mobile: true, status: true, lastRevokedAt: true },
  });
  if (!dealer || dealer.mobile !== payload.mobile) return null;
  if (dealer.status === 'BLOCKED' || dealer.status === 'REJECTED') return null;
  if (dealer.lastRevokedAt && payload.iat && dealer.lastRevokedAt.getTime() > payload.iat * 1000) return null;
  return dealer;
}

const sendOtpSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
});

const verifyOtpSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  otp: z.string().regex(/^\d{6}$/),
});

const registerSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  ownerName: z.string().min(2).max(100),
  shopName: z.string().min(2).max(150),
  whatsappNumber: z.string().regex(/^[6-9]\d{9}$/),
  altMobile: z.string().regex(/^[6-9]\d{9}$/).optional().or(z.literal('')),
  city: z.string().min(2).max(100),
  tehsil: z.string().min(2).max(100),
  district: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  country: z.string().default('India'),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional().or(z.literal('')),
  businessType: z.enum([BusinessType.RETAIL_SHOP, BusinessType.WHOLESALER]),
});

// POST /api/auth/send-otp
router.post('/send-otp', otpRateLimit, async (req: Request, res: Response): Promise<void> => {
  const parse = sendOtpSchema.safeParse(req.body);
  if (!parse.success) {
    fail(res, 400, 'invalid_phone', parse.error.issues[0].message);
    return;
  }

  const { mobile } = parse.data;
  const now = Date.now();

  // Per-number limits, on top of the per-IP otpRateLimit: one code every 30s,
  // five an hour.
  const recent = await prisma.otpCode.findMany({
    where: { mobile, createdAt: { gt: new Date(now - HOUR_MS) } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  const latest = recent[recent.length - 1];
  if (latest) {
    const wait = Math.ceil((latest.createdAt.getTime() + RESEND_AFTER_SECONDS * 1000 - now) / 1000);
    if (wait > 0) {
      fail(res, 429, 'wait_before_resend', `Please wait ${wait}s before asking for another code.`, { retryAfter: wait });
      return;
    }
  }
  if (recent.length >= MAX_CODES_PER_HOUR) {
    const retryAfter = Math.max(1, Math.ceil((recent[0].createdAt.getTime() + HOUR_MS - now) / 1000));
    fail(res, 429, 'too_many_otps', 'Too many codes requested for this number. Try again later.', { retryAfter });
    return;
  }

  const otp = generateOtp();
  const created = await prisma.otpCode.create({
    data: { mobile, code: await bcrypt.hash(otp, 10), expiresAt: new Date(now + OTP_TTL_SECONDS * 1000) },
    select: { id: true },
  });

  if (!(await sendOtp(mobile, otp))) {
    // Nothing reached the dealer: drop the new code so it doesn't count against
    // their limits, and leave any earlier code working.
    await prisma.otpCode.delete({ where: { id: created.id } });
    fail(res, 502, 'delivery_failed', "Couldn't send the code on WhatsApp. Please try again.");
    return;
  }

  // The new code supersedes every earlier one for this number.
  await prisma.otpCode.updateMany({
    where: { mobile, used: false, id: { not: created.id } },
    data: { used: true },
  });

  res.json({ success: true, expiresIn: OTP_TTL_SECONDS, resendIn: RESEND_AFTER_SECONDS });
});

// POST /api/auth/verify-otp
router.post('/verify-otp', otpVerifyRateLimit, async (req: Request, res: Response): Promise<void> => {
  const parse = verifyOtpSchema.safeParse(req.body);
  if (!parse.success) {
    fail(res, 400, 'invalid_input', 'Enter the 6-digit code.');
    return;
  }

  const { mobile, otp } = parse.data;

  const isDevBypass =
    process.env.ENABLE_OTP_BYPASS === 'true' &&
    process.env.NODE_ENV !== 'production' &&
    otp === '000000';

  if (!isDevBypass) {
    // Normally exactly one live code (a new one supersedes the rest); compare via bcrypt.
    const candidates = await prisma.otpCode.findMany({
      where: { mobile, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (candidates.length === 0) {
      fail(res, 400, 'otp_expired_or_missing', 'Code expired or locked. Please request a new one.');
      return;
    }

    let matchedId: string | null = null;
    for (const candidate of candidates) {
      if (await bcrypt.compare(otp, candidate.code)) { matchedId = candidate.id; break; }
    }

    if (!matchedId) {
      const { attempts } = await prisma.otpCode.update({
        where: { id: candidates[0].id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      const attemptsLeft = MAX_ATTEMPTS - attempts;
      if (attemptsLeft <= 0) {
        await prisma.otpCode.updateMany({ where: { mobile, used: false }, data: { used: true } });
        fail(res, 429, 'too_many_attempts', 'Too many wrong codes. Please request a new one.');
        return;
      }
      fail(res, 400, 'invalid_otp', 'Wrong code.', { attemptsLeft });
      return;
    }

    // Claim the code atomically so two requests can't both spend it.
    const claimed = await prisma.otpCode.updateMany({
      where: { id: matchedId, used: false },
      data: { used: true, verifiedAt: new Date() },
    });
    if (claimed.count === 0) {
      fail(res, 400, 'otp_expired_or_missing', 'Code expired or locked. Please request a new one.');
      return;
    }
  }

  const dealer = await prisma.dealer.findUnique({ where: { mobile } });

  if (!dealer) {
    res.json({ success: true, newDealer: true, mobile });
    return;
  }

  if (dealer.status === 'BLOCKED' || dealer.status === 'REJECTED') {
    fail(res, 403, 'account_suspended', 'Your account has been suspended. Contact support.');
    return;
  }

  startSession(req, res, dealer);
  res.json({
    success: true,
    newDealer: false,
    user: { id: dealer.id, phone: dealer.mobile },
    dealer: dealerSummary(dealer),
  });
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parse.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  const data = parse.data;

  const { checkStateAllowed } = await import('../middleware/geo');
  const stateAllowed = await checkStateAllowed(data.state);
  if (!stateAllowed) {
    res.status(403).json({ success: false, message: 'Registration is not available in your state.' });
    return;
  }

  if (process.env.ENABLE_OTP_BYPASS !== 'true' || process.env.NODE_ENV === 'production') {
    // Only a code that was actually entered correctly counts; superseded or
    // locked codes are also marked used and must not open registration.
    const verified = await prisma.otpCode.findFirst({
      where: { mobile: data.mobile, verifiedAt: { gt: new Date(Date.now() - REGISTER_WINDOW_MS) } },
      select: { id: true },
    });

    if (!verified) {
      res.status(401).json({ success: false, message: 'Mobile verification required. Please verify your OTP first.' });
      return;
    }
  }

  const existing = await prisma.dealer.findUnique({ where: { mobile: data.mobile } });
  if (existing) {
    res.status(409).json({ success: false, message: 'An account with this mobile already exists.' });
    return;
  }

  const dealer = await prisma.dealer.create({
    data: {
      mobile: data.mobile,
      ownerName: data.ownerName,
      shopName: data.shopName,
      whatsappNumber: data.whatsappNumber,
      altMobile: data.altMobile || null,
      city: data.city,
      tehsil: data.tehsil,
      district: data.district,
      state: data.state,
      country: data.country,
      pincode: data.pincode,
      gstNumber: data.gstNumber || null,
      businessType: data.businessType,
      status: 'ACTIVE',
    },
  });

  startSession(req, res, dealer);
  res.status(201).json({
    success: true,
    user: { id: dealer.id, phone: dealer.mobile },
    dealer: dealerSummary(dealer),
  });
});

// GET /api/auth/me — the signed-in dealer, or 401 (and a cleared cookie).
// The storefront calls this on every visit, which also keeps the dealer signed
// in: a cookie more than a day old is re-issued for a full DEALER_SESSION_DAYS.
router.get('/me', requireDealerAuth, async (req: Request, res: Response): Promise<void> => {
  const dealer = await prisma.dealer.findUnique({
    where: { id: req.dealer!.dealerId },
    select: { id: true, ownerName: true, shopName: true, mobile: true, status: true },
  });
  if (!dealer || dealer.status === 'BLOCKED' || dealer.status === 'REJECTED') {
    clearSessionCookie(req, res);
    res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    return;
  }
  const issuedAt = (req.dealer!.iat ?? 0) * 1000;
  if (readDealerToken(req)?.fromCookie && Date.now() - issuedAt > RENEW_SESSION_AFTER_MS) {
    setSessionCookie(req, res, generateDealerToken(dealer.id, dealer.mobile));
  }
  res.json({ success: true, sub: dealer.id, phone: dealer.mobile, dealer: dealerSummary(dealer) });
});

// GET /api/auth/device — the number this browser remembers, so the login page
// can offer number-only login. Always 200; a cookie that no longer holds is cleared.
router.get('/device', async (req: Request, res: Response): Promise<void> => {
  const dealer = await rememberedDealer(req);
  if (!dealer && readDeviceCookie(req)) clearDeviceCookie(req, res);
  res.json({ success: true, mobile: dealer?.mobile ?? null });
});

// POST /api/auth/device-login — number-only login on a remembered phone. Any
// other phone, or another number, gets otp_required and goes through the code.
router.post('/device-login', async (req: Request, res: Response): Promise<void> => {
  const parse = sendOtpSchema.safeParse(req.body);
  if (!parse.success) {
    fail(res, 400, 'invalid_phone', parse.error.issues[0].message);
    return;
  }
  const dealer = await rememberedDealer(req);
  if (!dealer || dealer.mobile !== parse.data.mobile) {
    fail(res, 401, 'otp_required', 'This phone needs a WhatsApp code to sign in.');
    return;
  }
  startSession(req, res, dealer);
  res.json({ success: true, user: { id: dealer.id, phone: dealer.mobile }, dealer: dealerSummary(dealer) });
});

// POST /api/auth/logout — ends the session; the phone stays remembered.
router.post('/logout', (req: Request, res: Response): void => {
  clearSessionCookie(req, res);
  res.json({ success: true });
});

// POST /api/auth/admin/login
router.post('/admin/login', adminLoginRateLimit, async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ success: false, message: 'Username and password required' });
    return;
  }

  const { generateAdminToken } = await import('../middleware/auth');

  const admin = await prisma.adminUser.findUnique({
    where: { username },
    include: { role: true },
  });
  if (!admin) {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
    return;
  }

  // Deactivated accounts can authenticate-by-password but are denied a session.
  if (!admin.active) {
    res.status(403).json({ success: false, message: 'This account has been deactivated.' });
    return;
  }

  const token = generateAdminToken(admin.id, admin.username);
  res.json({
    success: true,
    token,
    admin: { id: admin.id, username: admin.username, role: admin.role?.name ?? null },
  });
});

export default router;
