/**
 * Admin product-feature management. Mounted at /api/admin/features behind
 * MANAGE_PRODUCTS (index.ts).
 *
 * Full CRUD over the ProductFeature master list (supported technologies). Inputs
 * validated with zod, slugs derived via the local toSlug helper. Mirrors the
 * admin/brands convention: P2002 → 409, P2025 → 404, { success, data } envelope.
 * Delete cascades to ProductFeatureLink (schema onDelete: Cascade), so removing a
 * feature detaches it from every product.
 */
import { Router, Request, Response } from 'express';
import { ProductFeatureCategory, FeatureDisplayMode } from '@prisma/client';
import { z } from 'zod';
import { requireAdminAuth } from '../../middleware/auth';
import prisma from '../../lib/prisma';

const router = Router();
router.use(requireAdminAuth);

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// `logo` = the icon; `image` = the larger photo. Both accept a stored URL, a
// public /product-features/*.svg path, or a data-URI. Length-capped so a base64
// data-URI (used for small inline SVG icons) fits without an unbounded field.
const featureSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).optional(),
  logo: z.string().max(2_000_000).default(''),
  image: z.string().max(2_000_000).default(''),
  displayMode: z.nativeEnum(FeatureDisplayMode).default('ICON'),
  category: z.nativeEnum(ProductFeatureCategory).default('CHARGING'),
  description: z.string().max(500).default(''),
  active: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
});

// GET /api/admin/features — full list incl. inactive, with usage count
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const features = await prisma.productFeature.findMany({
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    res.json({
      success: true,
      data: features.map((f) => ({ ...f, productCount: f._count.products, _count: undefined })),
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch features' });
  }
});

// GET /api/admin/features/library — assets already used across features, for the
// "Choose from Library" picker. Deduplicated by URL; each entry carries the kind
// (icon|image), the owning feature's name + category (for search/filter), so the
// client can offer a searchable gallery without a separate media-asset subsystem.
router.get('/library', async (_req: Request, res: Response): Promise<void> => {
  try {
    const features = await prisma.productFeature.findMany({
      select: { name: true, category: true, logo: true, image: true },
      orderBy: { name: 'asc' },
    });

    const seen = new Set<string>();
    const assets: { url: string; kind: 'icon' | 'image'; name: string; category: string }[] = [];
    for (const f of features) {
      for (const [kind, url] of [['icon', f.logo] as const, ['image', f.image] as const]) {
        if (url && !seen.has(`${kind}:${url}`)) {
          seen.add(`${kind}:${url}`);
          assets.push({ url, kind, name: f.name, category: f.category });
        }
      }
    }

    res.json({ success: true, data: assets });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load asset library' });
  }
});

// POST /api/admin/features
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parse = featureSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, errors: parse.error.issues });
    return;
  }
  const { name, slug, ...rest } = parse.data;
  const resolvedSlug = slug || toSlug(name);
  try {
    const feature = await prisma.productFeature.create({ data: { name, slug: resolvedSlug, ...rest } });
    res.status(201).json({ success: true, data: feature });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      res.status(409).json({ success: false, message: 'A feature with that slug already exists' });
      return;
    }
    throw e;
  }
});

// PUT /api/admin/features/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parse = featureSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, errors: parse.error.issues });
    return;
  }
  // IMPORTANT: zod `.partial()` still injects field defaults (e.g. logo: '') for
  // keys the caller didn't send, so writing all of parse.data on a partial update
  // would wipe unspecified columns. Only persist fields ACTUALLY present in the
  // request body — a { displayMode } toggle must not blank out logo/image.
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { name, slug, ...rest } = parse.data;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (key in body) data[key] = value;
  }
  if ('name' in body && name !== undefined) {
    data.name = name;
    // Re-derive slug from the new name only when the caller didn't send one.
    if (!('slug' in body)) data.slug = toSlug(name);
  }
  if ('slug' in body && slug !== undefined) data.slug = slug;

  try {
    const feature = await prisma.productFeature.update({ where: { id }, data });
    res.json({ success: true, data: feature });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Feature not found' });
      return;
    }
    if (e?.code === 'P2002') {
      res.status(409).json({ success: false, message: 'A feature with that slug already exists' });
      return;
    }
    throw e;
  }
});

// DELETE /api/admin/features/:id — cascades to product links
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    await prisma.productFeature.delete({ where: { id } });
    res.json({ success: true, message: 'Feature deleted' });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Feature not found' });
      return;
    }
    throw e;
  }
});

export default router;
