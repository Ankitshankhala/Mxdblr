import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAdminAuth } from '../../middleware/auth';
import prisma from '../../lib/prisma';

const router = Router();

router.use(requireAdminAuth);

const geoSchema = z.object({
  state: z.string().min(2).max(100),
  district: z.string().min(2).max(100).optional(),
  allowed: z.boolean(),
});

// GET /api/admin/geo
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const restrictions = await prisma.geoRestriction.findMany({
    orderBy: [{ state: 'asc' }, { district: 'asc' }],
  });
  res.json({ success: true, data: restrictions });
});

// POST /api/admin/geo
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parse = geoSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, errors: parse.error.issues });
    return;
  }

  const { state, district, allowed } = parse.data;
  const adminUsername = req.admin!.username;
  const districtKey = district || '';

  const restriction = await prisma.geoRestriction.upsert({
    where: { state_district: { state, district: districtKey } },
    update: { allowed, updatedBy: adminUsername },
    create: { state, district: districtKey, allowed, updatedBy: adminUsername },
  });

  res.json({ success: true, data: restriction });
});

// DELETE /api/admin/geo/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await prisma.geoRestriction.delete({ where: { id } });
  res.json({ success: true, message: 'Geo restriction removed' });
});

export default router;
