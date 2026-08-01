/**
 * Admin product management. Mounted at /api/admin/products behind
 * MANAGE_PRODUCTS|MANAGE_INVENTORY (index.ts); mutations additionally require
 * MANAGE_PRODUCTS via requireLoadedPermission, while stock updates allow
 * MANAGE_INVENTORY.
 *
 * List/create/update/delete products, toggle new-arrival/best-seller, update
 * stock (PATCH|PUT /:id/stock), GET /stock-summary (dashboard low-stock counts),
 * and POST /csv-import (bulk import). All mutating routes map Prisma P2025 →
 * 404 rather than 500. Includes inline CSV parsing helpers.
 */
import express, { Router, Request, Response } from 'express';
import { StockStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAdminAuth } from '../../middleware/auth';
import { requireLoadedPermission } from '../../middleware/rbac';
import prisma from '../../lib/prisma';

// ── CSV helpers (for /csv-import) ─────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { field += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === ',' && !inQuote) {
      fields.push(field); field = '';
    } else { field += ch; }
  }
  fields.push(field);
  return fields;
}

function parseCSVText(text: string): Record<string, string>[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') inQuote = !inQuote;
    if (ch === '\n' && !inQuote) { lines.push(current); current = ''; }
    else { current += ch; }
  }
  if (current.trim()) lines.push(current);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim(); });
    return row;
  });
}

const CATEGORY_SLUG_MAP: Record<string, { name: string; slug: string; displayOrder: number }> = {
  'Head Phone':     { name: 'Headphones',      slug: 'headphones',       displayOrder: 1 },
  'Ear Phone':      { name: 'Earphones',        slug: 'earphones',        displayOrder: 2 },
  'Speaker':        { name: 'Speakers',         slug: 'speakers',         displayOrder: 3 },
  'Power Bank':     { name: 'Power Banks',      slug: 'power-banks',      displayOrder: 4 },
  'Charger':        { name: 'Chargers',         slug: 'chargers',         displayOrder: 5 },
  'Phone Case':     { name: 'Phone Cases',      slug: 'phone-cases',      displayOrder: 6 },
  'Stand & Holder': { name: 'Stands & Holders', slug: 'stands-holders',   displayOrder: 7 },
  'AirPods':        { name: 'AirPods',          slug: 'airpods',          displayOrder: 8 },
  'Smart Watch':    { name: 'Smart Watches',    slug: 'smart-watches',    displayOrder: 9 },
  'Microphone':     { name: 'Microphones',      slug: 'microphones',      displayOrder: 10 },
  'Mobile Battery': { name: 'Mobile Batteries', slug: 'mobile-batteries', displayOrder: 11 },
  'Data Cable':     { name: 'Data Cables',      slug: 'data-cables',      displayOrder: 12 },
};

function csvNameToSku(name: string): string {
  return name.trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9\-]/g, '').replace(/-+/g, '-').toUpperCase();
}

const router = Router();

router.use(requireAdminAuth);

const createProductSchema = z.object({
  name: z.string().min(2).max(255),
  brand: z.string().min(1).max(100),
  sku: z.string().min(2).max(50),
  description: z.string().optional(),
  moq: z.number().int().positive().default(1),
  stockStatus: z.nativeEnum(StockStatus).default('IN_STOCK'),
  stockQty: z.number().int().min(0).default(0),
  // Normalize: accept array OR comma-separated string, always store as array.
  // Each URL is validated to prevent injection of arbitrary non-URL strings.
  images: z.union([
    z.array(z.string().url('Each image must be a valid URL')),
    z.string().transform((s) => s ? s.split(',').map((u) => u.trim()).filter(Boolean) : []),
  ]).default([]),
  categoryId: z.string().optional(),
  active: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  // Accept either attributeTypeId (existing type) or name (auto-create/find type)
  attributes: z.array(
    z.union([
      z.object({ attributeTypeId: z.string(), value: z.string() }),
      z.object({ name: z.string().min(1), value: z.string() }),
    ])
  ).default([]),
  compatibilityTags: z.array(z.string()).default([]),
  // Supported technologies, referenced by ProductFeature.slug. Unknown slugs are
  // ignored (not created) — features are managed via /api/admin/features.
  featureSlugs: z.array(z.string()).default([]),
});

const updateProductSchema = createProductSchema.partial();

// Resolve feature slugs → ordered ProductFeatureLink create rows. Preserves the
// admin-supplied order (drives which icons surface first on the max-4 card) and
// silently drops slugs that don't match an existing feature.
async function resolveFeatureLinks(slugs: string[]): Promise<{ featureId: string; displayOrder: number }[]> {
  if (slugs.length === 0) return [];
  const found = await prisma.productFeature.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(found.map((f) => [f.slug, f.id]));
  return slugs
    .map((slug, i) => {
      const featureId = idBySlug.get(slug);
      return featureId ? { featureId, displayOrder: i } : null;
    })
    .filter((x): x is { featureId: string; displayOrder: number } => x !== null);
}

function sanitizeAdminProduct(p: Record<string, unknown>) {
  return {
    ...p,
    price: undefined,
    pricingActive: undefined,
  };
}

type RawAttr = { attributeTypeId: string; value: string } | { name: string; value: string };

async function resolveAttributeTypeId(attr: RawAttr, categoryId?: string): Promise<string> {
  if ('attributeTypeId' in attr) return attr.attributeTypeId;
  const existing = await prisma.attributeType.findFirst({
    where: { name: { equals: attr.name, mode: 'insensitive' } },
  });
  if (existing) return existing.id;
  const created = await prisma.attributeType.create({ data: { name: attr.name, categoryId: categoryId ?? null } });
  return created.id;
}

// POST /api/admin/products/csv-import
// Larger body limit for CSV text payload (up to ~5k products). Global limit is 8mb.
router.post('/csv-import', requireLoadedPermission('MANAGE_PRODUCTS'), express.json({ limit: '10mb' }), async (req: Request, res: Response): Promise<void> => {
  const { csv } = req.body as { csv?: string };
  if (!csv || typeof csv !== 'string') {
    res.status(400).json({ success: false, error: 'csv field is required' });
    return;
  }

  const rows = parseCSVText(csv);
  if (rows.length === 0) {
    res.status(400).json({ success: false, error: 'CSV is empty or has no data rows' });
    return;
  }

  const catIdCache: Record<string, string> = {};
  const results = { imported: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const name = (row['name'] || '').trim();
    if (!name) continue;

    try {
      // Resolve category
      const catKey = row['category'] || '';
      if (catKey && !catIdCache[catKey]) {
        const def = CATEGORY_SLUG_MAP[catKey];
        const slug = def
          ? def.slug
          : catKey.toLowerCase().replace(/\s+&\s+/g, '-and-').replace(/\s+/g, '-');
        const cat = await prisma.category.upsert({
          where: { slug },
          update: {},
          create: def ?? { name: catKey, slug, displayOrder: 99 },
        });
        catIdCache[catKey] = cat.id;
      }

      const sku = row['sku'] || csvNameToSku(name);
      const images = (row['image_urls'] || '').split('|').filter(Boolean);
      const catId = catIdCache[catKey] || undefined;
      const description = (row['description'] || '').trim();
      const moq = row['moq'] ? parseInt(row['moq'], 10) : 10;

      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) {
        await prisma.product.update({
          where: { sku },
          data: { name, description, ...(images.length > 0 && { images }), ...(catId && { categoryId: catId }) },
        });
        results.updated++;
      } else {
        await prisma.product.create({
          data: {
            name,
            brand: row['brand'] || 'MXD',
            sku,
            description,
            moq: isNaN(moq) ? 10 : moq,
            stockStatus: 'IN_STOCK',
            stockQty: 100,
            images,
            ...(catId && { categoryId: catId }),
          },
        });
        results.imported++;
      }
    } catch (e: any) {
      results.errors.push(`${name}: ${e.message}`);
      results.skipped++;
    }
  }

  res.json({ success: true, ...results });
});

const SORT_MAP: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  newest:     { createdAt: 'desc' },
  oldest:     { createdAt: 'asc' },
  name_asc:   { name: 'asc' },
  name_desc:  { name: 'desc' },
  sku_asc:    { sku: 'asc' },
  stock_high: { stockQty: 'desc' },
  stock_low:  { stockQty: 'asc' },
};

// GET /api/admin/products/stock-summary
router.get('/stock-summary', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const summary = await prisma.product.groupBy({
      by: ['stockStatus'],
      _count: { stockStatus: true },
    });
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stock summary' });
  }
});

// GET /api/admin/products
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, category, stockStatus, brand, sortBy, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ProductWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { sku: { contains: String(search), mode: 'insensitive' } },
        { brand: { contains: String(search), mode: 'insensitive' } },
      ];
    }
    if (brand) where.brand = { contains: String(brand), mode: 'insensitive' };
    if (category) where.category = { slug: String(category) };
    if (stockStatus) where.stockStatus = String(stockStatus) as StockStatus;

    const orderBy = (SORT_MAP[String(sortBy)] ?? { createdAt: 'desc' }) as Prisma.ProductOrderByWithRelationInput;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        include: {
          category: { select: { name: true, slug: true } },
          _count: { select: { cartItems: true, notificationSubs: true } },
          attributes: { include: { attributeType: { select: { name: true, unit: true } } } },
          features: {
            orderBy: { displayOrder: 'asc' },
            include: { feature: { select: { name: true, slug: true, logo: true, category: true } } },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Standard envelope: { success, data, pagination }. (Was previously a flat
    // { products, count, total, page, limit, pages } shape — envelope drift.)
    res.json({
      success: true,
      data: products.map(sanitizeAdminProduct),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// POST /api/admin/products
router.post('/', requireLoadedPermission('MANAGE_PRODUCTS'), async (req: Request, res: Response): Promise<void> => {
  const parse = createProductSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, errors: parse.error.issues });
    return;
  }

  const { attributes, compatibilityTags, featureSlugs, images, ...productData } = parse.data;

  const existing = await prisma.product.findUnique({ where: { sku: productData.sku } });
  if (existing) {
    res.status(409).json({ success: false, message: `SKU ${productData.sku} already exists` });
    return;
  }

  const resolvedAttrs = await Promise.all(
    attributes.map(async (a) => ({
      attributeTypeId: await resolveAttributeTypeId(a, productData.categoryId),
      value: a.value,
    }))
  );

  const featureLinks = await resolveFeatureLinks(featureSlugs);

  const product = await prisma.product.create({
    data: {
      ...productData,
      images,
      attributes: { create: resolvedAttrs },
      compatibilityTags: { create: compatibilityTags.map((tag) => ({ tag })) },
      features: { create: featureLinks },
    },
    include: {
      attributes: { include: { attributeType: true } },
      compatibilityTags: true,
      features: { include: { feature: true } },
      category: true,
    },
  });

  res.status(201).json({ success: true, data: sanitizeAdminProduct(product as unknown as Record<string, unknown>) });
});

// PUT /api/admin/products/:id
router.put('/:id', requireLoadedPermission('MANAGE_PRODUCTS'), async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parse = updateProductSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, errors: parse.error.issues });
    return;
  }

  const { attributes, compatibilityTags, featureSlugs, images, ...productData } = parse.data;

  const resolvedAttrs = attributes !== undefined
    ? await Promise.all(
        attributes.map(async (a) => ({
          attributeTypeId: await resolveAttributeTypeId(a, productData.categoryId),
          value: a.value,
        }))
      )
    : undefined;

  const featureLinks = featureSlugs !== undefined ? await resolveFeatureLinks(featureSlugs) : undefined;

  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...productData,
        ...(images !== undefined && { images }),
        ...(resolvedAttrs !== undefined && {
          attributes: {
            deleteMany: {},
            create: resolvedAttrs,
          },
        }),
        ...(compatibilityTags !== undefined && {
          compatibilityTags: {
            deleteMany: {},
            create: compatibilityTags.map((tag) => ({ tag })),
          },
        }),
        ...(featureLinks !== undefined && {
          features: {
            deleteMany: {},
            create: featureLinks,
          },
        }),
      },
      include: {
        attributes: { include: { attributeType: true } },
        compatibilityTags: true,
        features: { include: { feature: true } },
        category: true,
      },
    });

    res.json({ success: true, data: sanitizeAdminProduct(product as unknown as Record<string, unknown>) });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    throw e;
  }
});

// DELETE /api/admin/products/:id
router.delete('/:id', requireLoadedPermission('MANAGE_PRODUCTS'), async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    await prisma.product.delete({ where: { id } });
    res.json({ success: true, message: 'Product deleted' });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    // Foreign-key constraint: product is still referenced by a relation that is
    // not set to cascade. Return a clear 409 instead of an opaque 500 so the
    // admin knows the product is in use rather than the request having errored.
    if (e?.code === 'P2003') {
      res.status(409).json({ success: false, message: 'Product is still referenced by other records and cannot be deleted' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
});

// PATCH /api/admin/products/:id/new-arrival — toggle isNewArrival flag
router.patch('/:id/new-arrival', requireLoadedPermission('MANAGE_PRODUCTS'), async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { isNewArrival } = req.body as { isNewArrival?: boolean };
  if (typeof isNewArrival !== 'boolean') {
    res.status(400).json({ success: false, message: 'isNewArrival must be a boolean' });
    return;
  }
  try {
    const product = await prisma.product.update({
      where: { id },
      data: { isNewArrival },
    });
    res.json({ success: true, data: sanitizeAdminProduct(product as unknown as Record<string, unknown>) });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    throw e;
  }
});

// PATCH /api/admin/products/:id/best-seller — toggle isBestSeller flag
router.patch('/:id/best-seller', requireLoadedPermission('MANAGE_PRODUCTS'), async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { isBestSeller } = req.body as { isBestSeller?: boolean };
  if (typeof isBestSeller !== 'boolean') {
    res.status(400).json({ success: false, message: 'isBestSeller must be a boolean' });
    return;
  }
  try {
    const product = await prisma.product.update({
      where: { id },
      data: { isBestSeller },
    });
    res.json({ success: true, data: sanitizeAdminProduct(product as unknown as Record<string, unknown>) });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    throw e;
  }
});

// PATCH /api/admin/products/:id/active — toggle storefront visibility
router.patch('/:id/active', requireLoadedPermission('MANAGE_PRODUCTS'), async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { active } = req.body as { active?: boolean };
  if (typeof active !== 'boolean') {
    res.status(400).json({ success: false, message: 'active must be a boolean' });
    return;
  }
  try {
    const product = await prisma.product.update({
      where: { id },
      data: { active },
    });
    res.json({ success: true, data: sanitizeAdminProduct(product as unknown as Record<string, unknown>) });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    throw e;
  }
});

const stockUpdateSchema = z.object({
  stockStatus: z.nativeEnum(StockStatus),
  stockQty: z.number().int().min(0).optional(),
});

async function handleStockUpdate(req: Request, res: Response): Promise<void> {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const parse = stockUpdateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, message: parse.error.issues[0].message });
    return;
  }

  const { stockStatus, stockQty } = parse.data;

  try {
    const product = await prisma.product.update({
      where: { id },
      data: { stockStatus, ...(stockQty !== undefined && { stockQty }) },
    });

    res.json({ success: true, data: sanitizeAdminProduct(product as unknown as Record<string, unknown>) });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    throw e;
  }
}

// PATCH /api/admin/products/:id/stock
router.patch('/:id/stock', handleStockUpdate);

// PUT /api/admin/products/:id/stock (alias for frontend)
router.put('/:id/stock', handleStockUpdate);

export default router;
