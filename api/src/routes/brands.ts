import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/brands — public list of active brands for the filter sidebar
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const brands = await prisma.brand.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true, logo: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: brands });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch brands' });
  }
});

export default router;
