import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAdminAuth } from '../../middleware/auth';
import prisma from '../../lib/prisma';

const router = Router();
router.use(requireAdminAuth);

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const brandSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).optional(),
  logo: z.string().default(''),
  active: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
});

// GET /api/admin/brands
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const brands = await prisma.brand.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] });
    res.json({ success: true, data: brands });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch brands' });
  }
});

// POST /api/admin/brands
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parse = brandSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, errors: parse.error.issues });
    return;
  }
  const { name, slug, ...rest } = parse.data;
  const resolvedSlug = slug || toSlug(name);
  try {
    const brand = await prisma.brand.create({ data: { name, slug: resolvedSlug, ...rest } });
    res.status(201).json({ success: true, data: brand });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      res.status(409).json({ success: false, message: 'A brand with that name or slug already exists' });
      return;
    }
    throw e;
  }
});

// PUT /api/admin/brands/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parse = brandSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, errors: parse.error.issues });
    return;
  }
  const { name, slug, ...rest } = parse.data;
  const data: Record<string, unknown> = { ...rest };
  if (name !== undefined) data.name = name;
  if (slug !== undefined) data.slug = slug;
  else if (name !== undefined) data.slug = toSlug(name);

  try {
    const brand = await prisma.brand.update({ where: { id }, data });
    res.json({ success: true, data: brand });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Brand not found' });
      return;
    }
    if (e?.code === 'P2002') {
      res.status(409).json({ success: false, message: 'A brand with that name or slug already exists' });
      return;
    }
    throw e;
  }
});

// DELETE /api/admin/brands/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    await prisma.brand.delete({ where: { id } });
    res.json({ success: true, message: 'Brand deleted' });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Brand not found' });
      return;
    }
    throw e;
  }
});

export default router;
