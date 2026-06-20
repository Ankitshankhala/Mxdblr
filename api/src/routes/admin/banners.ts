/**
 * Admin banner management. Mounted at /api/admin/banners behind MANAGE_PRODUCTS.
 *
 * Full CRUD over homepage hero banners (admin list includes inactive ones) plus
 * PUT /reorder/bulk to set displayOrder. Public read is routes/banners.ts.
 */
import { Router } from 'express';
import prisma from '../../lib/prisma';
import { requireAdminAuth } from '../../middleware/auth';

const router = Router();
router.use(requireAdminAuth);

// GET all banners (admin — includes inactive)
router.get('/', async (_req, res) => {
  try {
    const banners = await prisma.banner.findMany({ orderBy: { displayOrder: 'asc' } });
    res.json({ success: true, data: banners });
  } catch {
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

// POST create banner
router.post('/', async (req, res) => {
  try {
    const {
      bannerType, title, subtitle, ctaText, ctaLink,
      image, bgColor, accentColor,
      logoImage, productImage1, productImage2, productImage3,
      overlayOpacity, textAlignment,
      active, displayOrder,
    } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const count = await prisma.banner.count();
    const banner = await prisma.banner.create({
      data: {
        bannerType: bannerType || 'SIMPLE',
        title,
        subtitle: subtitle || '',
        ctaText: ctaText || 'Browse Catalog',
        ctaLink: ctaLink || '/catalog',
        image: image || '',
        bgColor: bgColor || '#1A1A2E',
        accentColor: accentColor || '#F47920',
        logoImage: logoImage || '',
        productImage1: productImage1 || '',
        productImage2: productImage2 || '',
        productImage3: productImage3 || '',
        overlayOpacity: overlayOpacity ?? 0.35,
        textAlignment: textAlignment || 'left',
        active: active !== false,
        displayOrder: displayOrder ?? count,
      },
    });
    res.json({ success: true, data: banner });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to create banner' });
  }
});

// PUT reorder — body: { items: [{ id, displayOrder }] }
// Must be defined BEFORE /:id to prevent Express matching "reorder" as an id param
router.put('/reorder/bulk', async (req, res) => {
  try {
    const { items } = req.body as { items: { id: string; displayOrder: number }[] };
    await Promise.all(items.map((item) =>
      prisma.banner.update({ where: { id: item.id }, data: { displayOrder: item.displayOrder } })
    ));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to reorder banners' });
  }
});

// PUT update banner
router.put('/:id', async (req, res) => {
  try {
    const {
      bannerType, title, subtitle, ctaText, ctaLink,
      image, bgColor, accentColor,
      logoImage, productImage1, productImage2, productImage3,
      overlayOpacity, textAlignment,
      active, displayOrder,
    } = req.body;
    const banner = await prisma.banner.update({
      where: { id: req.params.id },
      data: {
        ...(bannerType !== undefined && { bannerType }),
        ...(title !== undefined && { title }),
        ...(subtitle !== undefined && { subtitle }),
        ...(ctaText !== undefined && { ctaText }),
        ...(ctaLink !== undefined && { ctaLink }),
        ...(image !== undefined && { image }),
        ...(bgColor !== undefined && { bgColor }),
        ...(accentColor !== undefined && { accentColor }),
        ...(logoImage !== undefined && { logoImage }),
        ...(productImage1 !== undefined && { productImage1 }),
        ...(productImage2 !== undefined && { productImage2 }),
        ...(productImage3 !== undefined && { productImage3 }),
        ...(overlayOpacity !== undefined && { overlayOpacity }),
        ...(textAlignment !== undefined && { textAlignment }),
        ...(active !== undefined && { active }),
        ...(displayOrder !== undefined && { displayOrder }),
      },
    });
    res.json({ success: true, data: banner });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to update banner' });
  }
});

// DELETE banner
router.delete('/:id', async (req, res) => {
  try {
    await prisma.banner.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete banner' });
  }
});

export default router;
