/**
 * Public events routes. Mounted at /api/events.
 *
 * GET / — published "Events & Activities" for the homepage. Order honours the
 * admin-set manual sequence first (displayOrder asc), then newest event date,
 * then a stable id tiebreaker so equal dates never reorder between requests.
 * "Featured" is surfaced as a badge on the card, not as a sort key, so the
 * displayed order matches the admin reorder controls exactly (latest / chosen
 * order first). Read-only; admin CRUD lives in routes/admin/events.ts. Returns
 * the standard { success, data } envelope.
 */
import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/events — public, published events. Optional ?limit=N (default 12, max 50).
router.get('/', async (req, res) => {
  try {
    const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 12;
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 12;

    const events = await prisma.event.findMany({
      where: { published: true },
      orderBy: [{ displayOrder: 'asc' }, { eventDate: 'desc' }, { id: 'asc' }],
      take: limit,
    });

    res.json({ success: true, data: events });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
});

export default router;
