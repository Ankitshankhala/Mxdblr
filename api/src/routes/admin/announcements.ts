/**
 * Admin announcement management. Mounted at /api/admin/announcements behind
 * MANAGE_PRODUCTS.
 *
 * Full CRUD over the storefront marquee messages (admin list includes inactive
 * ones). Public read is routes/announcements.ts.
 */
import { Router } from 'express';
import prisma from '../../lib/prisma';
import { requireAdminAuth } from '../../middleware/auth';

const router = Router();
router.use(requireAdminAuth);

// GET all announcements (admin — includes inactive)
router.get('/', async (_req, res) => {
  try {
    const items = await prisma.announcement.findMany({ orderBy: { displayOrder: 'asc' } });
    res.json({ success: true, data: items });
  } catch {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// POST create announcement
router.post('/', async (req, res) => {
  try {
    const { text, active, displayOrder } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const count = await prisma.announcement.count();
    const item = await prisma.announcement.create({
      data: {
        text: String(text).trim(),
        active: active !== false,
        displayOrder: displayOrder ?? count,
      },
    });
    res.json({ success: true, data: item });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to create announcement' });
  }
});

// PUT update announcement
router.put('/:id', async (req, res) => {
  try {
    const { text, active, displayOrder } = req.body;
    const item = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        ...(text !== undefined && { text: String(text).trim() }),
        ...(active !== undefined && { active }),
        ...(displayOrder !== undefined && { displayOrder }),
      },
    });
    res.json({ success: true, data: item });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Announcement not found' });
    res.status(500).json({ error: e?.message || 'Failed to update announcement' });
  }
});

// DELETE announcement
router.delete('/:id', async (req, res) => {
  try {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Announcement not found' });
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

export default router;
