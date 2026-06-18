import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/announcements — public, active marquee messages ordered by displayOrder
router.get('/', async (_req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
    });
    res.json({ success: true, data: announcements });
  } catch {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

export default router;
