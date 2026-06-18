import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../../middleware/auth';
import prisma from '../../lib/prisma';

const router = Router();
router.use(requireAdminAuth);

function toSlug(name: string): string {
  return name.trim().toLowerCase()
    .replace(/\s+&\s+/g, '-and-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let n = 0;
  while (true) {
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${++n}`;
  }
}

// GET /api/admin/categories — flat list with product counts and children count
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [categories, activeGroups, outOfStockGroups] = await Promise.all([
      prisma.category.findMany({
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { products: true, children: true } },
        },
      }),
      prisma.product.groupBy({
        by: ['categoryId'],
        where: { stockStatus: 'IN_STOCK', categoryId: { not: null } },
        _count: { id: true },
      }),
      prisma.product.groupBy({
        by: ['categoryId'],
        where: { stockStatus: 'OUT_OF_STOCK', categoryId: { not: null } },
        _count: { id: true },
      }),
    ]);

    const activeMap = new Map(activeGroups.map((g) => [g.categoryId, g._count.id]));
    const outOfStockMap = new Map(outOfStockGroups.map((g) => [g.categoryId, g._count.id]));

    const withStats = categories.map((cat) => ({
      ...cat,
      productCount: cat._count.products,
      childrenCount: cat._count.children,
      activeProductCount: activeMap.get(cat.id) ?? 0,
      outOfStockCount: outOfStockMap.get(cat.id) ?? 0,
    }));
    res.json({ success: true, data: withStats });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

// POST /api/admin/categories
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, image, active, parentId, displayOrder } = req.body;
    if (!name?.trim()) { res.status(400).json({ success: false, error: 'Name is required' }); return; }
    const count = await prisma.category.count();
    const base = toSlug(name);
    const slug = await uniqueSlug(base);
    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
        description: description || '',
        image: image || '',
        active: active !== false,
        parentId: parentId || null,
        displayOrder: displayOrder ?? count,
      },
    });
    res.status(201).json({ success: true, data: category });
  } catch (e: any) {
    process.stderr.write(`[categories] create error: ${e?.message}\n`);
    res.status(500).json({ success: false, error: e?.message || 'Failed to create category' });
  }
});

// PUT /api/admin/categories/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, description, image, active, parentId, displayOrder } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      data.name = name.trim();
      const base = toSlug(name);
      data.slug = await uniqueSlug(base, id);
    }
    if (description !== undefined) data.description = description;
    if (image !== undefined) data.image = image;
    if (active !== undefined) data.active = active;
    if (parentId !== undefined) data.parentId = parentId || null;
    if (displayOrder !== undefined) data.displayOrder = displayOrder;
    const category = await prisma.category.update({ where: { id }, data });
    res.json({ success: true, data: category });
  } catch (e: any) {
    process.stderr.write(`[categories] update error: ${e?.message}\n`);
    res.status(500).json({ success: false, error: e?.message || 'Failed to update category' });
  }
});

// PATCH /api/admin/categories/:id/toggle — toggle active status
router.patch('/:id/toggle', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const cat = await prisma.category.findUnique({ where: { id } });
    if (!cat) { res.status(404).json({ success: false, error: 'Not found' }); return; }
    const updated = await prisma.category.update({ where: { id }, data: { active: !cat.active } });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to toggle category' });
  }
});

// DELETE /api/admin/categories/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const [childCount, productCount] = await Promise.all([
      prisma.category.count({ where: { parentId: id } }),
      prisma.product.count({ where: { categoryId: id } }),
    ]);
    if (childCount > 0) { res.status(400).json({ success: false, error: 'Delete sub-categories first' }); return; }
    if (productCount > 0) { res.status(400).json({ success: false, error: `Move or delete the ${productCount} product(s) in this category first` }); return; }
    await prisma.category.delete({ where: { id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
});

// POST /api/admin/categories/bulk — bulk activate/deactivate/delete
router.post('/bulk', async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, ids } = req.body as { action: 'activate' | 'deactivate' | 'delete'; ids: string[] };
    if (!ids?.length) { res.status(400).json({ success: false, error: 'No ids provided' }); return; }
    if (action === 'activate') {
      await prisma.category.updateMany({ where: { id: { in: ids } }, data: { active: true } });
    } else if (action === 'deactivate') {
      await prisma.category.updateMany({ where: { id: { in: ids } }, data: { active: false } });
    } else if (action === 'delete') {
      // Only delete categories with no children and no products
      await prisma.category.deleteMany({
        where: {
          id: { in: ids },
          children: { none: {} },
          products: { none: {} },
        },
      });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Bulk action failed' });
  }
});

// GET /api/admin/categories/:id/products — products in a category
router.get('/:id/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { search } = req.query;
    const where: Record<string, unknown> = { categoryId: id };
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { sku: { contains: String(search) } },
      ];
    }
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, sku: true, brand: true,
        stockStatus: true, stockQty: true, moq: true, images: true,
        createdAt: true, updatedAt: true,
      },
    });
    res.json({ success: true, data: products });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

export default router;
