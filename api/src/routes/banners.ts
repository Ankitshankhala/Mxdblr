/**
 * Public banner routes. Mounted at /api/banners.
 *
 * GET / — active homepage hero banners ordered by displayOrder. Read-only;
 * admin CRUD lives in routes/admin/banners.ts.
 */
import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/banners — public, active banners ordered by displayOrder
router.get('/', async (_req, res) => {
  try {
    const banners = await prisma.banner.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
    });
    res.json({ success: true, data: banners });
  } catch {
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

export default router;
