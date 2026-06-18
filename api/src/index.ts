import 'dotenv/config';
import path from 'path';

// Fail fast before any imports that need env vars
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    process.stderr.write(`[FATAL] Missing required environment variable: ${key}\n`);
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
import announcementsRouter from './routes/announcements';
import adminAnnouncementsRouter from './routes/admin/announcements';

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
app.use('/api/announcements', announcementsRouter);

// Auth-required dealer routes
app.use('/api/cart', cartRouter);
app.use('/api/dealers', dealersRouter);

// Mixed-auth notification routes
app.use('/api', notificationsRouter);

// Admin routes (all require admin JWT)
app.use('/api/admin/categories', adminCategoriesRouter);
app.use('/api/admin/products', adminProductsRouter);
app.use('/api/admin/dealers', adminDealersRouter);
app.use('/api/admin/inquiries', adminOrdersRouter);
app.use('/api/admin/orders', adminOrdersRouter);   // alias used by frontend
app.use('/api/admin/notify', adminNotificationsRouter);
app.use('/api/admin/geo', adminGeoRouter);
app.use('/api/admin/banners', adminBannersRouter);
app.use('/api/admin/brands', adminBrandsRouter);
app.use('/api/admin/settings', adminSettingsRouter);
app.use('/api/admin/upload', adminUploadRouter);
app.use('/api/admin/announcements', adminAnnouncementsRouter);

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
