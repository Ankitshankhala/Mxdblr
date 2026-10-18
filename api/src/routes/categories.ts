/**
 * Public category routes. Mounted at /api/categories (geo-gated).
 *
 * GET /        — active categories that have at least one visible product (in
 *                themselves or a sub-category), for the nav, filter sidebar and
 *                homepage. Empty ones are left out so dealers never land on an
 *                empty catalog; admins still see every category via /api/admin.
 * GET /:slug   — single category by slug. Read-only.
 */
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/categories — active, non-empty categories, with full fields
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const allCategories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    // Only storefront-visible products count; hidden ones don't fill a category.
    include: { _count: { select: { products: { where: { active: true } } } } },
  });

  type CatNode = {
    id: string;
    name: string;
    slug: string;
    description: string;
    image: string;
    active: boolean;
    parentId: string | null;
    displayOrder: number;
    productCount: number;
    children: CatNode[];
  };

  const categoryMap = new Map<string, CatNode>();

  allCategories.forEach((cat) => {
    categoryMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      image: cat.image,
      active: cat.active,
      parentId: cat.parentId,
      displayOrder: cat.displayOrder,
      productCount: cat._count.products,
      children: [],
    });
  });

  const roots: CatNode[] = [];
  categoryMap.forEach((cat) => {
    if (cat.parentId) {
      const parent = categoryMap.get(cat.parentId);
      if (parent) parent.children.push(cat);
    } else {
      roots.push(cat);
    }
  });

  // Drop categories with no visible products, unless a sub-category has some.
  const withProducts = (nodes: CatNode[]): CatNode[] =>
    nodes.filter((n) => {
      n.children = withProducts(n.children);
      return n.productCount > 0 || n.children.length > 0;
    });

  res.json({ success: true, data: withProducts(roots) });
});

// GET /api/categories/:slug
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      children: {
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { products: true } } },
      },
      parent: { select: { id: true, name: true, slug: true } },
      _count: { select: { products: true } },
    },
  });

  if (!category) {
    res.status(404).json({ success: false, message: 'Category not found' });
    return;
  }

  res.json({ success: true, data: category });
});

export default router;
