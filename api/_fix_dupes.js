/**
 * One-off data repair (2026-08-12):
 *  1. Merge duplicate product MXD-605-AUX-CABLE (legacy, has images) into
 *     MXD-605 (current SKU convention, no images), then delete the legacy row.
 *  2. Delete the empty duplicate "Stands & Holders" category (slug
 *     stands-and-holders, 0 products, legacy base64 image) — the live one is
 *     slug stands-holders with 9 products.
 *
 * Writes a JSON backup of every deleted row before touching anything.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter: new PrismaPg(pool) });

const LEGACY_SKU = 'MXD-605-AUX-CABLE';
const KEEP_SKU = 'MXD-605';
const DUP_CAT_SLUG = 'stands-and-holders';

(async () => {
  const legacy = await p.product.findUnique({ where: { sku: LEGACY_SKU } });
  const keep = await p.product.findUnique({ where: { sku: KEEP_SKU } });
  const dupCat = await p.category.findUnique({
    where: { slug: DUP_CAT_SLUG },
    include: { _count: { select: { products: true, children: true } } },
  });

  const backup = { takenAt: new Date().toISOString(), legacyProduct: legacy, duplicateCategory: dupCat };
  const backupPath = path.join(__dirname, `_backup_dupes_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log('backup written ->', backupPath);

  // --- 1. product merge ---
  if (!legacy || !keep) {
    console.log('product merge SKIPPED (one of the rows is already gone)');
  } else {
    const mergedImages = keep.images?.length ? keep.images : legacy.images || [];
    await p.product.update({ where: { id: keep.id }, data: { images: mergedImages } });
    await p.product.delete({ where: { id: legacy.id } });
    console.log(`merged ${mergedImages.length} image(s) into ${KEEP_SKU}; deleted ${LEGACY_SKU}`);
  }

  // --- 2. duplicate category ---
  if (!dupCat) {
    console.log('category dedupe SKIPPED (already gone)');
  } else if (dupCat._count.products > 0 || dupCat._count.children > 0) {
    console.log(`category dedupe ABORTED — ${DUP_CAT_SLUG} now has ${dupCat._count.products} products / ${dupCat._count.children} children`);
  } else {
    await p.category.delete({ where: { id: dupCat.id } });
    console.log(`deleted empty duplicate category ${DUP_CAT_SLUG}`);
  }

  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
