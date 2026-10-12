/**
 * Category icon backfill. Run: npx ts-node src/prisma/fix-category-icons.ts
 *
 * The MXD catalogue import (seed-mxd-catalog.ts) created six categories with no
 * icon or description, and those six hold most of the live stock. Each has a
 * near-identical category from the original taxonomy that already carries an
 * admin-uploaded icon, so copy the icon and description across.
 *
 * Idempotent and non-destructive: only fills fields that are empty on the
 * target, never overwrites an icon or description an admin has since set, and
 * skips any pair where either category is missing.
 */
import 'dotenv/config';
import prisma from '../lib/prisma';

// target slug (has products, no icon) -> source slug (has the matching icon)
const ICON_SOURCES: Record<string, string> = {
  'adapters': 'otg-and-adapters',
  'airpods': 'tws-earbuds',
  'data-cables': 'usb-data-cables',
  'earphones': 'wired-earphones',
  'pen-drives': 'memory-cards-and-pen-drives',
  'stands-and-holders': 'mobile-holders-and-stands',
};

async function main() {
  let updated = 0;
  for (const [targetSlug, sourceSlug] of Object.entries(ICON_SOURCES)) {
    const [target, source] = await Promise.all([
      prisma.category.findUnique({ where: { slug: targetSlug } }),
      prisma.category.findUnique({ where: { slug: sourceSlug } }),
    ]);
    if (!target || !source) {
      console.log(`- skip ${targetSlug}: ${!target ? targetSlug : sourceSlug} not found`);
      continue;
    }

    const data: { image?: string; description?: string } = {};
    if (!target.image && source.image) data.image = source.image;
    if (!target.description && source.description) data.description = source.description;
    if (!Object.keys(data).length) {
      console.log(`- ${target.name}: already set, left alone`);
      continue;
    }

    await prisma.category.update({ where: { id: target.id }, data });
    updated++;
    console.log(`✓ ${target.name} <- ${source.name} (${Object.keys(data).join(', ')})`);
  }
  console.log(`Done: ${updated} categories updated`);
}

if (require.main === module) {
  main()
    .catch((e) => { console.error('Icon backfill failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
