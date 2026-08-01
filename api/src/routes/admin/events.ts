/**
 * Admin events management. Mounted at /api/admin/events behind MANAGE_PRODUCTS.
 *
 * Full CRUD over "Events & Activities" (admin list includes unpublished) plus
 * PUT /reorder/bulk for displayOrder. Publish/unpublish and feature toggles are
 * partial PUT updates ({ published } / { featured }). Public read is routes/events.ts.
 *
 * Media: `images` is an array of stored URLs (from /api/admin/upload). `videos` is
 * an array of { url, thumbnailUrl?, source? } — URL entries without a source are
 * normalised server-side via parseVideoUrl so providers/thumbnails are consistent.
 */
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { requireAdminAuth } from '../../middleware/auth';
import { parseVideoUrl, EventVideo } from '../../lib/video';

const router = Router();
router.use(requireAdminAuth);

const videoInput = z.object({
  url: z.string().min(1).max(1000),
  thumbnailUrl: z.string().max(1000).optional(),
  source: z.enum(['youtube', 'vimeo', 'upload', 'url']).optional(),
});

const eventBase = {
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  category: z
    .enum(['PRODUCT_LAUNCH', 'DEALER_MEETUP', 'TRAINING', 'EXHIBITION', 'CELEBRATION', 'OTHER'])
    .optional(),
  eventDate: z.string().min(1),
  location: z.string().max(200).optional(),
  coverImage: z.string().max(1000).optional(),
  images: z.array(z.string().max(1000)).max(30).optional(),
  videos: z.array(videoInput).max(20).optional(),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
};

const createSchema = z.object(eventBase);
const updateSchema = z.object({ ...eventBase, title: eventBase.title.optional(), eventDate: z.string().min(1).optional() });

// Normalise mixed video input into the stored { url, thumbnailUrl, source } shape.
function normalizeVideos(input?: z.infer<typeof videoInput>[]): EventVideo[] {
  if (!input) return [];
  return input.map((v) => {
    // Uploaded files keep their stored Cloudinary/local URL + derived poster.
    if (v.source === 'upload') {
      return { url: v.url, thumbnailUrl: v.thumbnailUrl ?? '', source: 'upload' };
    }
    // Everything else is re-derived from the URL itself so a pasted YouTube/Vimeo
    // link is always tagged correctly (source + thumbnail) — never trusted as the
    // generic 'url' the admin sends for a freshly added link.
    return parseVideoUrl(v.url);
  });
}

function parseDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// GET all events (admin — includes unpublished), ordered for the management table
router.get('/', async (_req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: [{ displayOrder: 'asc' }, { eventDate: 'desc' }],
    });
    res.json({ success: true, data: events });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
});

// GET one event (admin — for the edit/preview screen)
router.get('/:id', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }
    res.json({ success: true, data: event });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch event' });
  }
});

// POST create event
router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Invalid event data', errors: parsed.error.flatten() });
    return;
  }
  const date = parseDate(parsed.data.eventDate);
  if (!date) {
    res.status(400).json({ success: false, message: 'Invalid eventDate' });
    return;
  }
  try {
    const count = await prisma.event.count();
    const event = await prisma.event.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? '',
        category: parsed.data.category ?? 'OTHER',
        eventDate: date,
        location: parsed.data.location ?? '',
        coverImage: parsed.data.coverImage ?? '',
        images: parsed.data.images ?? [],
        videos: normalizeVideos(parsed.data.videos) as object,
        published: parsed.data.published ?? false,
        featured: parsed.data.featured ?? false,
        displayOrder: parsed.data.displayOrder ?? count,
      },
    });
    res.json({ success: true, data: event });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create event' });
  }
});

// PUT reorder — body: { items: [{ id, displayOrder }] }
// Defined BEFORE /:id so Express does not match "reorder" as an :id param.
router.put('/reorder/bulk', async (req, res) => {
  try {
    const { items } = req.body as { items?: { id: string; displayOrder: number }[] };
    if (!Array.isArray(items)) {
      res.status(400).json({ success: false, message: 'items array required' });
      return;
    }
    await prisma.$transaction(
      items.map((item) =>
        prisma.event.update({ where: { id: item.id }, data: { displayOrder: item.displayOrder } })
      )
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to reorder events' });
  }
});

// PUT update event (partial — also used for publish/feature quick-toggles)
router.put('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Invalid event data', errors: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;

  let eventDate: Date | undefined;
  if (d.eventDate !== undefined) {
    const date = parseDate(d.eventDate);
    if (!date) {
      res.status(400).json({ success: false, message: 'Invalid eventDate' });
      return;
    }
    eventDate = date;
  }

  try {
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...(d.title !== undefined && { title: d.title }),
        ...(d.description !== undefined && { description: d.description }),
        ...(d.category !== undefined && { category: d.category }),
        ...(eventDate !== undefined && { eventDate }),
        ...(d.location !== undefined && { location: d.location }),
        ...(d.coverImage !== undefined && { coverImage: d.coverImage }),
        ...(d.images !== undefined && { images: d.images }),
        ...(d.videos !== undefined && { videos: normalizeVideos(d.videos) as object }),
        ...(d.published !== undefined && { published: d.published }),
        ...(d.featured !== undefined && { featured: d.featured }),
        ...(d.displayOrder !== undefined && { displayOrder: d.displayOrder }),
      },
    });
    res.json({ success: true, data: event });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2025') {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to update event' });
  }
});

// DELETE event
router.delete('/:id', async (req, res) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2025') {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
});

export default router;
