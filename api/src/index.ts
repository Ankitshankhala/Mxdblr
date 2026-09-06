/**
 * API entry point — Express app bootstrap and the single source of route wiring.
 *
 * Fails fast if required env vars (DATABASE_URL, JWT_SECRET) are missing, then
 * configures security (helmet), CORS (allow-list + LAN origins in dev only),
 * logging, body parsing, and the global rate limiter. Mounts every router and is
 * where authorization policy lives: public routers are geo-gated, dealer routers
 * require a dealer JWT, and each admin router is mounted behind the RBAC
 * permission(s) it needs. Also serves /uploads (dev image fallback) with a
 * cross-origin CORP header, a JSON 404, and a global error handler that never
 * leaks internals in production. Exported for supertest; only listens outside tests.
 */
import 'dotenv/config';
import path from 'path';
import { initObservability, captureError } from './lib/observability';

// Initialise error monitoring as early as possible (no-op unless SENTRY_DSN set).
initObservability();

// Fail fast before any imports that need env vars
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    process.stderr.write(`[FATAL] Missing required environment variable: ${key}\n`);
    process.exit(1);
  }
}

// Production-only hardening. These conditions are survivable in development but
// are silent, total failures in production: an unset messaging credential makes
// sendOtp() no-op and return success, so every dealer is locked out while the API
// reports healthy, and a leftover OTP bypass authenticates any mobile number.
// Refusing to boot is the only failure mode that gets noticed.
if (process.env.NODE_ENV === 'production') {
  const fatal: string[] = [];

  // A var copied from the template and never filled in is present but useless --
  // a bare presence check passes it and the failure resurfaces at runtime as a
  // broken upload or an OTP that never arrives. Treat placeholders as unset.
  const PLACEHOLDER_RE = /^(replace|your[_-]|xxx|todo|changeme|dummy|<)/i;
  const missing = (key: string): boolean => {
    const v = (process.env[key] || '').trim();
    return v === '' || PLACEHOLDER_RE.test(v);
  };

  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret.length < 64) {
    fatal.push(`JWT_SECRET is ${jwtSecret.length} chars; needs >= 64 (256-bit). Generate with: openssl rand -hex 32`);
  }
  if (/dev|test|local|change ?me|secret123/i.test(jwtSecret)) {
    fatal.push('JWT_SECRET looks like a development placeholder.');
  }
  if (process.env.ENABLE_OTP_BYPASS === 'true') {
    fatal.push('ENABLE_OTP_BYPASS=true in production would accept 000000 as a valid OTP for any number. Remove it.');
  }
  if (missing('MSG91_AUTH_KEY')) {
    fatal.push('MSG91_AUTH_KEY is unset or a placeholder, so OTP delivery silently no-ops and no dealer can sign in.');
  }
  if (missing('MSG91_TEMPLATE_ID')) {
    fatal.push('MSG91_TEMPLATE_ID is unset or a placeholder; the MSG91 v5 OTP endpoint requires it.');
  }
  if (missing('SETTINGS_ENCRYPTION_KEY')) {
    fatal.push('SETTINGS_ENCRYPTION_KEY is unset; encrypted settings cannot be read or written.');
  }
  // Cloudinary is a WARNING, not a failure. saveLocally() returns a relative
  // /uploads/... path that normalizeImageUrl() resolves against the public API
  // origin, and nginx proxies /uploads through to this process — so images render
  // correctly without it. What you lose is CDN edge delivery and automatic
  // f_auto/q_auto optimisation, plus the images then live only on this box's disk
  // and must be covered by your backups.
  const cloudinary = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].filter(
    (k) => missing(k)
  );
  if (cloudinary.length > 0) {
    process.stderr.write(
      `[WARN] ${cloudinary.join(', ')} unset — image uploads are served from local disk.\n` +
        '       Images render fine, but there is no CDN or auto-optimisation, and\n' +
        '       the api/uploads directory must be included in your backups.\n'
    );
  }
  // Gate 4 requires error monitoring live before handover. initObservability()
  // above is a no-op without a DSN, so production would run blind.
  if (missing('SENTRY_DSN')) {
    fatal.push('SENTRY_DSN is unset or a placeholder; the API would run with no error monitoring.');
  }

  if (fatal.length > 0) {
    process.stderr.write('[FATAL] Refusing to start in production:\n');
    for (const msg of fatal) process.stderr.write(`  - ${msg}\n`);
    process.exit(1);
  }
}

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { apiRateLimit } from './middleware/rateLimit';
import { geoCheckMiddleware } from './middleware/geo';

// Route imports
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import categoriesRouter from './routes/categories';
import cartRouter from './routes/cart';
import dealersRouter from './routes/dealers';
import notificationsRouter from './routes/notifications';

// Admin route imports
import adminCategoriesRouter from './routes/admin/categories';
import adminProductsRouter from './routes/admin/products';
import adminDealersRouter from './routes/admin/dealers';
import adminOrdersRouter from './routes/admin/orders';
import adminNotificationsRouter from './routes/admin/notifications';
import adminGeoRouter from './routes/admin/geo';
import adminBannersRouter from './routes/admin/banners';
import adminBrandsRouter from './routes/admin/brands';
import adminSettingsRouter from './routes/admin/settings';
import adminUploadRouter from './routes/admin/upload';
import bannersRouter from './routes/banners';
import brandsRouter from './routes/brands';
import featuresRouter from './routes/features';
import announcementsRouter from './routes/announcements';
import eventsRouter from './routes/events';
import adminAnnouncementsRouter from './routes/admin/announcements';
import adminEventsRouter from './routes/admin/events';
import adminFeaturesRouter from './routes/admin/features';
import adminRbacRouter from './routes/admin/rbac';
import adminUsersRouter from './routes/admin/users';

// RBAC permission guards
import { requirePermission, requireAnyPermission } from './middleware/rbac';

const app = express();
// Trust the first proxy hop so req.ip reflects the real client IP
// (required for correct geo-restriction and rate-limiting behind Nginx/Vercel/Railway)
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT || '4000');

// Security headers
app.use(helmet());

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'https://mxdblr.com',
  'https://www.mxdblr.com',
  'https://portal.mxdblr.com',
];

const LAN_ORIGIN_RE = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;

// CORS — allow portal origins + LAN IPs in development
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && LAN_ORIGIN_RE.test(origin)) return callback(null, true);
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsers
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

// Global rate limiter
app.use('/api', apiRateLimit);

// Health check (no auth required)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'mxdblr-api',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Public routes — geo-gated
app.use('/api/auth', geoCheckMiddleware, authRouter);
app.use('/api/products', geoCheckMiddleware, productsRouter);
app.use('/api/categories', geoCheckMiddleware, categoriesRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/features', featuresRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/events', eventsRouter);

// Auth-required dealer routes
app.use('/api/cart', cartRouter);
app.use('/api/dealers', dealersRouter);

// Mixed-auth notification routes
app.use('/api', notificationsRouter);

// RBAC management + current-user context (each route self-guards by permission)
app.use('/api/admin', adminRbacRouter);                 // /me, /permissions, /roles, /audit-logs
app.use('/api/admin/users', adminUsersRouter);          // staff/admin account management

// Admin routes — each mounted behind the permission(s) it requires. Routers still run
// requireAdminAuth internally; these guards add the authorization layer (RBAC).
// Routers with mixed needs (products: catalog vs inventory; orders: read vs edit) take a
// broad guard here and a stricter per-endpoint guard inside the router.
app.use('/api/admin/categories', requirePermission('MANAGE_PRODUCTS'), adminCategoriesRouter);
app.use('/api/admin/products', requireAnyPermission('MANAGE_PRODUCTS', 'MANAGE_INVENTORY'), adminProductsRouter);
app.use('/api/admin/dealers', requirePermission('MANAGE_CUSTOMERS'), adminDealersRouter);
app.use('/api/admin/inquiries', requireAnyPermission('CREATE_ORDERS', 'EDIT_ORDERS', 'VIEW_REPORTS'), adminOrdersRouter);
app.use('/api/admin/orders', requireAnyPermission('CREATE_ORDERS', 'EDIT_ORDERS', 'VIEW_REPORTS'), adminOrdersRouter);   // alias used by frontend
app.use('/api/admin/notify', requirePermission('MANAGE_CUSTOMERS'), adminNotificationsRouter);
app.use('/api/admin/geo', requirePermission('SYSTEM_SETTINGS'), adminGeoRouter);
app.use('/api/admin/banners', requirePermission('MANAGE_PRODUCTS'), adminBannersRouter);
app.use('/api/admin/brands', requirePermission('MANAGE_PRODUCTS'), adminBrandsRouter);
app.use('/api/admin/features', requirePermission('MANAGE_PRODUCTS'), adminFeaturesRouter);
app.use('/api/admin/settings', requirePermission('SYSTEM_SETTINGS'), adminSettingsRouter);
app.use('/api/admin/upload', requirePermission('MANAGE_PRODUCTS'), adminUploadRouter);
app.use('/api/admin/announcements', requirePermission('MANAGE_PRODUCTS'), adminAnnouncementsRouter);
app.use('/api/admin/events', requirePermission('MANAGE_PRODUCTS'), adminEventsRouter);

// Local image uploads (dev fallback — used when Cloudinary credentials are not set).
// Override CORP header: helmet() sets same-origin by default, which blocks <img> tags
// on the frontend (localhost:3000) from loading images served from localhost:4000.
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500;
  const isDev = process.env.NODE_ENV === 'development';

  // Log error server-side only
  if (process.env.NODE_ENV !== 'test') {
    process.stderr.write(`[ERROR] ${status} ${err.message}\n${err.stack}\n`);
  }

  // Report unexpected failures (5xx) to Sentry when enabled; 4xx are expected.
  if (status >= 500) captureError(err);

  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : err.message,
    ...(isDev && { detail: err.message }),
  });
});

// Supertest binds its own ephemeral port — don't occupy 4000 during test runs
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    process.stdout.write(`[mxdblr-api] Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})\n`);
  });
}

export default app;
