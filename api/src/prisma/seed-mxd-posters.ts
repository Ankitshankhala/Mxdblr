/**
 * MXD product-poster import. Run: npx ts-node src/prisma/seed-mxd-posters.ts
 *
 * Imports catalog-assets/posters.json: one entry per product, built from the
 * client's product posters (model code, name and specs are printed on them).
 * Posters live in catalog-assets/posters/ and are copied into api/uploads/,
 * stored as RELATIVE /uploads/<file> paths like the rest of the catalogue.
 *
 * - SKU already exists: the posters are APPENDED after its current images (the
 *   clean product photo stays first on cards). The name is filled in only while
 *   it is still the bare SKU placeholder from the first catalogue import; the
 *   description and category are left alone.
 * - SKU is new: the product is created visible, IN_STOCK, MOQ 1, brand MXD.
 *
 * Idempotent: images already attached are not added twice and files are only
 * copied when absent or a different size, so re-running is safe.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';

interface PosterEntry {
  sku: string;
  name: string;
  category: string; // category slug
  description: string;
  images: string[]; // file names inside catalog-assets/posters/
}

async function main() {
  const assetDir = path.join(__dirname, 'catalog-assets');
  const imgDir = path.join(assetDir, 'posters');
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const entries: PosterEntry[] = JSON.parse(fs.readFileSync(path.join(assetDir, 'posters.json'), 'utf8'));
  console.log(`Read ${entries.length} products from posters.json`);

  // Fail before writing anything if an entry names a category or file we don't have.
  const slugs = [...new Set(entries.map((e) => e.category))];
  const categories = await prisma.category.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const categoryIds = new Map(categories.map((c) => [c.slug, c.id]));
  const missingCats = slugs.filter((s) => !categoryIds.has(s));
  if (missingCats.length) throw new Error(`Unknown category slugs: ${missingCats.join(', ')}`);
  const missingFiles = entries.flatMap((e) => e.images).filter((f) => !fs.existsSync(path.join(imgDir, f)));
  if (missingFiles.length) throw new Error(`Missing poster files: ${missingFiles.join(', ')}`);

  fs.mkdirSync(uploadsDir, { recursive: true });
  let created = 0, updated = 0, unchanged = 0, imagesCopied = 0;

  for (const e of entries) {
    const posterPaths = e.images.map((file) => {
      const src = path.join(imgDir, file);
      const dest = path.join(uploadsDir, file);
      if (!fs.existsSync(dest) || fs.statSync(dest).size !== fs.statSync(src).size) {
        fs.copyFileSync(src, dest);
        imagesCopied++;
      }
      return `/uploads/${file}`;
    });

    const existing = await prisma.product.findUnique({
      where: { sku: e.sku },
      select: { id: true, name: true, description: true, images: true },
    });

    if (existing) {
      const newImages = posterPaths.filter((p) => !existing.images.includes(p));
      const data: { images?: string[]; name?: string; description?: string } = {};
      if (newImages.length) data.images = [...existing.images, ...newImages];
      if (existing.name === e.sku && e.name) data.name = e.name;
      if (!existing.description && e.description) data.description = e.description;
      if (Object.keys(data).length) {
        await prisma.product.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        unchanged++;
      }
      continue;
    }

    // Price stays null / pricingActive false: prices are quoted over WhatsApp.
    await prisma.product.create({
      data: {
        sku: e.sku,
        name: e.name,
        brand: 'MXD',
        description: e.description,
        categoryId: categoryIds.get(e.category)!,
        moq: 1,
        stockStatus: 'IN_STOCK',
        active: true,
        images: posterPaths,
      },
    });
    created++;
  }

  console.log(`✓ products: ${created} created, ${updated} updated, ${unchanged} already up to date`);
  console.log(`✓ posters: ${imagesCopied} copied into uploads/`);
  console.log(`DB now holds ${await prisma.product.count()} products`);
}

if (require.main === module) {
  main()
    .catch((e) => { console.error('Poster import failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
