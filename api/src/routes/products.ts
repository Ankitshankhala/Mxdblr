import { Router, Request, Response } from 'express';
import { StockStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/products/brands — distinct brands for filter UI
router.get('/brands', async (_req: Request, res: Response): Promise<void> => {
  try {
    const brands = await prisma.product.findMany({
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
    });
    res.json({ success: true, data: brands.map((b) => b.brand).filter(Boolean) });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch brands' });
  }
});

const productQuerySchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  search: z.string().optional(),
  stockStatus: z.nativeEnum(StockStatus).optional(),
  isNewArrival: z.coerce.boolean().optional(),
  isBestSeller: z.coerce.boolean().optional(),
  sort: z.enum(['name_asc', 'name_desc', 'newest', 'oldest']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(24),
});

// GET /api/products
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parse = productQuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({ success: false, message: 'Invalid query parameters' });
    return;
  }

  const { category, brand, search, stockStatus, isNewArrival, isBestSeller, sort, page, limit } = parse.data;
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {};

  if (category) where.category = { slug: category };
  if (brand) where.brand = { equals: brand, mode: 'insensitive' };
  if (isNewArrival !== undefined) where.isNewArrival = isNewArrival;
  if (isBestSeller !== undefined) where.isBestSeller = isBestSeller;
  if (search) {
    where.OR = [
      { name:        { contains: search, mode: 'insensitive' } },
      { sku:         { contains: search, mode: 'insensitive' } },
      { brand:       { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { category:    { name: { contains: search, mode: 'insensitive' } } },
    ];
  }
  if (stockStatus) where.stockStatus = stockStatus;

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === 'name_asc'  ? { name: 'asc' } :
    sort === 'name_desc' ? { name: 'desc' } :
    sort === 'oldest'    ? { createdAt: 'asc' } :
                           { createdAt: 'desc' };

  try {
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          attributes: { include: { attributeType: { select: { name: true, unit: true } } } },
          compatibilityTags: { select: { tag: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: products.map(sanitizeProduct),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id }, { sku: id }] },
      include: {
        category: { include: { parent: { select: { id: true, name: true, slug: true } } } },
        attributes: { include: { attributeType: { select: { name: true, unit: true } } } },
        compatibilityTags: { select: { tag: true } },
      },
    });

    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    const breadcrumb: Array<{ name: string; slug: string }> = [];
    if (product.category?.parent) {
      breadcrumb.push({ name: product.category.parent.name, slug: product.category.parent.slug });
    }
    if (product.category) {
      breadcrumb.push({ name: product.category.name, slug: product.category.slug });
    }

    res.json({ success: true, data: { ...sanitizeProduct(product), breadcrumb } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch product' });
  }
});

function sanitizeProduct(product: {
  id: string;
  name: string;
  brand: string;
  sku: string;
  description: string | null;
  moq: number;
  stockStatus: StockStatus;
  stockQty: number;
  images: string[];
  price?: number | null;
  pricingActive?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  categoryId: string | null;
  category?: { id: string; name: string; slug: string; parent?: { id: string; name: string; slug: string } | null } | null;
  attributes?: Array<{ attributeType: { name: string; unit: string | null }; value: string }>;
  compatibilityTags?: Array<{ tag: string }>;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    sku: product.sku,
    description: product.description,
    moq: product.moq,
    stockStatus: product.stockStatus,
    stockQty: product.stockQty,
    images: product.images,
    isNewArrival: product.isNewArrival ?? false,
    isBestSeller: product.isBestSeller ?? false,
    categoryId: product.categoryId,
    category: product.category
      ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
      : null,
    attributes: product.attributes?.map((a) => ({
      name: a.attributeType.name,
      value: a.value,
      unit: a.attributeType.unit,
    })),
    compatibilityTags: product.compatibilityTags?.map((t) => t.tag),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export default router;
