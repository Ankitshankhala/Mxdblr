/**
 * Public product-feature routes. Mounted at /api/features.
 *
 * GET / — active features (supported technologies) for the catalog / product
 *         detail UI and admin pickers. Read-only. Grouped client-side by
 *         `category`. Returns a { success, data } envelope.
 */
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/features — public list of active features
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const features = await prisma.productFeature.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true, logo: true, category: true, description: true },
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: features });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch features' });
  }
});

export default router;
