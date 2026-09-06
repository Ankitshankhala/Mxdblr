/**
 * Admin dealer (customer) management. Mounted at /api/admin/dealers behind
 * MANAGE_CUSTOMERS.
 *
 * GET /                — filterable, sortable, paginated dealer list.
 * GET /filters/options — distinct state/district/city values (for the cascading
 *                        filter dropdowns) + the businessType/status enum lists.
 * GET /export          — the SAME filtered/sorted result set as a downloadable
 *                        CSV (?format=csv, default) or Excel XML (?format=xlsx).
 * GET /:id             — single dealer detail.
 * PUT /:id/moderate    — approve / block / suspend a dealer (moderation action;
 *                        a block bumps lastRevokedAt to kill active sessions).
 *
 * NOTE on scope: filters map ONLY to columns that exist on the Dealer model
 * (state/district/city/businessType/status/gstNumber/createdAt). Spec items with
 * no backing column — dealer rating, verification flag, last-login, created-by,
 * email, PENDING status, per-dealer product category/brand — are intentionally
 * NOT implemented here; they require schema changes + a security review first.
 */
import { Router, Request, Response } from 'express';
import { DealerStatus, BusinessType, Prisma } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requireAdminAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';
import prisma from '../../lib/prisma';

const router = Router();

router.use(requireAdminAuth);

const moderationSchema = z.object({
  action: z.enum(['SUSPEND', 'BLOCK', 'REJECT', 'ACTIVATE']),
  reason: z.string().min(5).max(500).optional(),
});

// ── shared query parsing ─────────────────────────────────────────────────────

const DEALER_STATUSES = Object.values(DealerStatus);
const BUSINESS_TYPES = Object.values(BusinessType);

// Columns a client is allowed to sort by → the Prisma orderBy key. Whitelisted so
// a caller can never inject an arbitrary field name.
const SORT_FIELDS: Record<string, keyof Prisma.DealerOrderByWithRelationInput> = {
  name: 'ownerName',
  shop: 'shopName',
  date: 'createdAt',
  updated: 'updatedAt',
  state: 'state',
  city: 'city',
  district: 'district',
};

function firstString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return undefined;
}

interface DealerQuery {
  where: Prisma.DealerWhereInput;
  orderBy: Prisma.DealerOrderByWithRelationInput;
  page: number;
  limit: number;
}

/**
 * Build the Prisma where/orderBy/pagination from the request query. Shared by the
 * list endpoint and the export endpoint so an export always reflects exactly the
 * filters the admin currently sees. Unknown values are ignored (fail-open to "no
 * filter"), never trusted as raw SQL — enum/sort inputs are whitelisted.
 */
function buildDealerQuery(req: Request): DealerQuery {
  const status = firstString(req.query.status);
  const businessType = firstString(req.query.businessType);
  const state = firstString(req.query.state);
  const district = firstString(req.query.district);
  const city = firstString(req.query.city);
  const search = firstString(req.query.search);
  const from = firstString(req.query.from);
  const to = firstString(req.query.to);
  const sort = firstString(req.query.sort) ?? 'date';
  const dir = firstString(req.query.dir) === 'asc' ? 'asc' : 'desc';

  const where: Prisma.DealerWhereInput = {};

  if (status && (DEALER_STATUSES as string[]).includes(status)) {
    where.status = status as DealerStatus;
  }
  if (businessType && (BUSINESS_TYPES as string[]).includes(businessType)) {
    where.businessType = businessType as BusinessType;
  }
  // Geographic cascade — exact match (values come from /filters/options).
  if (state) where.state = state;
  if (district) where.district = district;
  if (city) where.city = city;

  if (search) {
    where.OR = [
      { ownerName: { contains: search, mode: 'insensitive' } },
      { shopName: { contains: search, mode: 'insensitive' } },
      { mobile: { contains: search } },
      { gstNumber: { contains: search, mode: 'insensitive' } },
      { id: { equals: search } }, // Dealer ID is an exact cuid
    ];
  }

  // Registration date range (inclusive). `to` is pushed to end-of-day so the
  // whole selected day is covered.
  const createdAt: Prisma.DateTimeFilter = {};
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) createdAt.gte = fromDate;
  if (toDate && !Number.isNaN(toDate.getTime())) {
    toDate.setHours(23, 59, 59, 999);
    createdAt.lte = toDate;
  }
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;

  const orderKey = SORT_FIELDS[sort] ?? 'createdAt';
  const orderBy: Prisma.DealerOrderByWithRelationInput = { [orderKey]: dir };

  const page = Math.max(1, parseInt(firstString(req.query.page) ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(firstString(req.query.limit) ?? '50', 10) || 50));

  return { where, orderBy, page, limit };
}

// GET /api/admin/dealers
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { where, orderBy, page, limit } = buildDealerQuery(req);
  const skip = (page - 1) * limit;

  const [dealers, total] = await Promise.all([
    prisma.dealer.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true, mobile: true, ownerName: true, shopName: true,
        city: true, tehsil: true, district: true, state: true, pincode: true,
        gstNumber: true, businessType: true, status: true,
        createdAt: true, updatedAt: true,
        _count: { select: { cartItems: true, inquiries: true } },
      },
    }),
    prisma.dealer.count({ where }),
  ]);

  res.json({
    success: true,
    data: dealers,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// GET /api/admin/dealers/filters/options
// Distinct state → district → city values for the cascading dropdowns, plus the
// enum lists. Optional ?state= / ?district= narrow the next level so the client
// can lazily load only the relevant children.
router.get('/filters/options', async (req: Request, res: Response): Promise<void> => {
  const state = firstString(req.query.state);
  const district = firstString(req.query.district);

  const [states, districts, cities] = await Promise.all([
    prisma.dealer.findMany({
      distinct: ['state'],
      where: { state: { not: '' } },
      select: { state: true },
      orderBy: { state: 'asc' },
    }),
    prisma.dealer.findMany({
      distinct: ['district'],
      where: { district: { not: '' }, ...(state ? { state } : {}) },
      select: { district: true },
      orderBy: { district: 'asc' },
    }),
    prisma.dealer.findMany({
      distinct: ['city'],
      where: {
        city: { not: '' },
        ...(state ? { state } : {}),
        ...(district ? { district } : {}),
      },
      select: { city: true },
      orderBy: { city: 'asc' },
    }),
  ]);

  res.json({
    success: true,
    data: {
      states: states.map((d) => d.state),
      districts: districts.map((d) => d.district),
      cities: cities.map((d) => d.city),
      businessTypes: BUSINESS_TYPES,
      statuses: DEALER_STATUSES,
      sortFields: Object.keys(SORT_FIELDS),
    },
  });
});

// ── export helpers ───────────────────────────────────────────────────────────

const EXPORT_COLUMNS: { header: string; key: string }[] = [
  { header: 'Dealer ID', key: 'id' },
  { header: 'Owner Name', key: 'ownerName' },
  { header: 'Shop Name', key: 'shopName' },
  { header: 'Mobile', key: 'mobile' },
  { header: 'GST Number', key: 'gstNumber' },
  { header: 'Business Type', key: 'businessType' },
  { header: 'Status', key: 'status' },
  { header: 'City', key: 'city' },
  { header: 'Tehsil', key: 'tehsil' },
  { header: 'District', key: 'district' },
  { header: 'State', key: 'state' },
  { header: 'Pincode', key: 'pincode' },
  { header: 'Registered On', key: 'createdAt' },
];

type ExportRow = Record<string, string | Date | null>;

function cellText(value: string | Date | null): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

// RFC-4180 CSV field: wrap in quotes and double internal quotes when the value
// contains a comma, quote, or newline. Prefixed BOM (added by caller) makes Excel
// open UTF-8 correctly.
function csvField(text: string): string {
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: ExportRow[]): string {
  const head = EXPORT_COLUMNS.map((c) => csvField(c.header)).join(',');
  const body = rows.map((r) =>
    EXPORT_COLUMNS.map((c) => csvField(cellText(r[c.key] ?? null))).join(',')
  );
  return '﻿' + [head, ...body].join('\r\n');
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// SpreadsheetML 2003 (.xls XML) — a single self-contained XML string Excel opens
// natively as a real worksheet, with zero third-party dependencies. Avoids adding
// an xlsx/zip library (and its supply-chain surface) for a plain tabular export.
function toExcelXml(rows: ExportRow[]): string {
  const headerCells = EXPORT_COLUMNS.map(
    (c) => `<Cell><Data ss:Type="String">${xmlEscape(c.header)}</Data></Cell>`
  ).join('');
  const bodyRows = rows
    .map((r) => {
      const cells = EXPORT_COLUMNS.map(
        (c) => `<Cell><Data ss:Type="String">${xmlEscape(cellText(r[c.key] ?? null))}</Data></Cell>`
      ).join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Dealers">
  <Table>
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

// GET /api/admin/dealers/export?format=csv|xlsx  (+ all the same filter params)
router.get('/export', async (req: Request, res: Response): Promise<void> => {
  const { where, orderBy } = buildDealerQuery(req);
  const format = firstString(req.query.format) === 'xlsx' ? 'xlsx' : 'csv';

  // Export the full filtered set (capped to protect the server), not just one page.
  const rows = (await prisma.dealer.findMany({
    where,
    orderBy,
    take: 10000,
    select: {
      id: true, ownerName: true, shopName: true, mobile: true, gstNumber: true,
      businessType: true, status: true, city: true, tehsil: true, district: true,
      state: true, pincode: true, createdAt: true,
    },
  })) as ExportRow[];

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'xlsx') {
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dealers-${stamp}.xls"`);
    res.send(toExcelXml(rows));
    return;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="dealers-${stamp}.csv"`);
  res.send(toCsv(rows));
});

// GET /api/admin/dealers/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const dealer = await prisma.dealer.findUnique({
    where: { id },
    include: {
      moderationLogs: {
        include: { admin: { select: { username: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      inquiries: { orderBy: { createdAt: 'desc' }, take: 10 },
      _count: { select: { cartItems: true, inquiries: true, notificationSubs: true } },
    },
  });

  if (!dealer) {
    res.status(404).json({ success: false, message: 'Dealer not found' });
    return;
  }

  res.json({ success: true, data: dealer });
});

// PUT /api/admin/dealers/:id/moderate
router.put('/:id/moderate', async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parse = moderationSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, errors: parse.error.issues });
    return;
  }

  const { action, reason } = parse.data;
  const adminId = req.admin!.adminId;

  const statusMap: Record<string, DealerStatus> = {
    SUSPEND: 'SUSPENDED',
    BLOCK: 'BLOCKED',
    REJECT: 'REJECTED',
    ACTIVATE: 'ACTIVE',
  };

  const newStatus = statusMap[action];

  // Revoke all active sessions by setting lastRevokedAt when blocking or suspending
  const shouldRevoke = action === 'BLOCK' || action === 'SUSPEND';

  const [dealer] = await Promise.all([
    prisma.dealer.update({
      where: { id },
      data: {
        status: newStatus,
        ...(shouldRevoke && { lastRevokedAt: new Date() }),
      },
      select: { id: true, ownerName: true, shopName: true, status: true },
    }),
    prisma.moderationLog.create({
      data: { dealerId: id, action, adminId, reason: reason || null },
    }),
  ]);

  res.json({ success: true, data: dealer });
});

// POST /api/admin/dealers/login-code
//
// STOPGAP until WhatsApp OTP delivery is live (Meta approval pending). Mints a
// one-time login code for a mobile number so an admin can relay it to the dealer
// by hand over the WhatsApp Business app. Deliberately reuses the OtpCode table
// and hashing that verify-otp already reads, so the dealer-facing flow is
// unchanged and this can be deleted in one piece once sendOtp() is wired to
// WhatsApp.
//
// The code is returned exactly ONCE, in this response. It is stored bcrypt-hashed
// like every other OTP and cannot be read back afterwards -- not from the admin
// UI, not from the database, not from the audit trail.
//
// Works for numbers with no dealer row yet: verify-otp answers newDealer:true and
// the caller proceeds into registration, exactly as it does for a real OTP.
const loginCodeSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
});

// Longer than the 5-minute SMS OTP: a human has to read this out of the admin UI
// and send it through a separate app before the dealer can use it.
const LOGIN_CODE_TTL_MS = 30 * 60 * 1000;

router.post('/login-code', async (req: Request, res: Response): Promise<void> => {
  const parse = loginCodeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, message: parse.error.issues[0].message });
    return;
  }

  const { mobile } = parse.data;

  const dealer = await prisma.dealer.findUnique({
    where: { mobile },
    select: { id: true, ownerName: true, shopName: true, status: true },
  });

  // Refuse to hand a working credential to an account that is barred from
  // logging in -- verify-otp would reject it anyway, so issuing one would only
  // waste the admin's time and the dealer's.
  if (dealer && (dealer.status === 'BLOCKED' || dealer.status === 'REJECTED')) {
    res.status(409).json({
      success: false,
      message: `This dealer is ${dealer.status.toLowerCase()} and cannot sign in. Reactivate the account first.`,
    });
    return;
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + LOGIN_CODE_TTL_MS);

  // Supersede any outstanding code for this number, mirroring POST /auth/send-otp.
  await prisma.otpCode.updateMany({ where: { mobile, used: false }, data: { used: true } });
  await prisma.otpCode.create({
    data: { mobile, code: await bcrypt.hash(code, 10), expiresAt },
  });

  // Records WHO issued a credential for WHICH number -- never the code itself.
  await writeAuditLog({
    actorId: req.admin!.adminId,
    actorName: req.admin!.username,
    action: 'DEALER_LOGIN_CODE_ISSUED',
    targetType: 'Dealer',
    targetId: dealer?.id ?? null,
    targetName: mobile,
    details: { newDealer: !dealer, expiresAt: expiresAt.toISOString() } as Prisma.InputJsonValue,
  });

  res.status(201).json({
    success: true,
    data: {
      code,
      mobile,
      expiresAt: expiresAt.toISOString(),
      newDealer: !dealer,
      dealer: dealer ?? null,
    },
  });
});

export default router;
