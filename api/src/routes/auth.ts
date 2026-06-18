import { Router, Request, Response } from 'express';
import { BusinessType } from '@prisma/client';
import { z } from 'zod';
// npm install bcryptjs @types/bcryptjs
import bcrypt from 'bcryptjs';
import { generateDealerToken } from '../middleware/auth';
import { sendOtp } from '../lib/msg91';
import { otpRateLimit, otpVerifyRateLimit, adminLoginRateLimit } from '../middleware/rateLimit';
import prisma from '../lib/prisma';

const router = Router();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const sendOtpSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
});

const verifyOtpSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  otp: z.string().length(6),
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
  businessType: z.nativeEnum(BusinessType),
});

// POST /api/auth/send-otp
router.post('/send-otp', otpRateLimit, async (req: Request, res: Response): Promise<void> => {
  const parse = sendOtpSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, message: parse.error.issues[0].message });
    return;
  }

  const { mobile } = parse.data;

  await prisma.otpCode.updateMany({
    where: { mobile, used: false },
    data: { used: true },
  });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const codeHash = await bcrypt.hash(String(otp), 10);
  await prisma.otpCode.create({ data: { mobile, code: codeHash, expiresAt } });

  const sent = await sendOtp(mobile, otp);
  if (!sent) {
    res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
    return;
  }

  res.json({ success: true, message: 'OTP sent successfully' });
});

// POST /api/auth/verify-otp
router.post('/verify-otp', otpVerifyRateLimit, async (req: Request, res: Response): Promise<void> => {
  const parse = verifyOtpSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, message: parse.error.issues[0].message });
    return;
  }

  const { mobile, otp } = parse.data;

  const isDevBypass =
    process.env.ENABLE_OTP_BYPASS === 'true' &&
    process.env.NODE_ENV !== 'production' &&
    otp === '000000';

  if (!isDevBypass) {
    // Fetch all unexpired, unused OTPs for this mobile — compare via bcrypt
    const candidates = await prisma.otpCode.findMany({
      where: { mobile, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    let matchedRecord: (typeof candidates)[number] | null = null;
    for (const candidate of candidates) {
      const isMatch = await bcrypt.compare(String(otp), candidate.code);
      if (isMatch) { matchedRecord = candidate; break; }
    }

    if (!matchedRecord) {
      res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
      return;
    }

    await prisma.otpCode.update({ where: { id: matchedRecord.id }, data: { used: true } });
  }

  const dealer = await prisma.dealer.findUnique({ where: { mobile } });

  if (!dealer) {
    res.json({ success: true, newDealer: true, mobile });
    return;
  }

  if (dealer.status === 'BLOCKED' || dealer.status === 'REJECTED') {
    res.status(403).json({ success: false, message: 'Your account has been suspended. Contact support.' });
    return;
  }

  const token = generateDealerToken(dealer.id, dealer.mobile);
  res.json({
    success: true,
    newDealer: false,
    token,
    dealer: { id: dealer.id, ownerName: dealer.ownerName, shopName: dealer.shopName, mobile: dealer.mobile, status: dealer.status },
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
    const recentOtp = await prisma.otpCode.findFirst({
      where: { mobile: data.mobile, used: true, expiresAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentOtp) {
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

  const token = generateDealerToken(dealer.id, dealer.mobile);
  res.status(201).json({
    success: true,
    token,
    dealer: { id: dealer.id, ownerName: dealer.ownerName, shopName: dealer.shopName, mobile: dealer.mobile, status: dealer.status },
  });
});

// POST /api/auth/admin/login
router.post('/admin/login', adminLoginRateLimit, async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ success: false, message: 'Username and password required' });
    return;
  }

  const { generateAdminToken } = await import('../middleware/auth');

  const admin = await prisma.adminUser.findUnique({ where: { username } });
  if (!admin) {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
    return;
  }

  const token = generateAdminToken(admin.id, admin.username, admin.role);
  res.json({ success: true, token, admin: { id: admin.id, username: admin.username, role: admin.role } });
});

export default router;
