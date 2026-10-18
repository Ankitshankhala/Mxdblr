/**
 * One-off content fixes from the pre-handover review (2026-10-18).
 * Run once on live: npx ts-node src/prisma/fix-content-2026-10.ts
 *
 * - Hero banners: slides 1 and 3 were both titled "MXD Earbuds" and every
 *   subtitle read "surrounding sounds". Each slide gets copy matching its image,
 *   written to HERO_BANNER_DESIGN_RULES.md (6–10 word headline, a word ending
 *   in "." takes the accent colour, 20–30 word subtitle).
 * - Product typo: "Megnet" -> "Magnet" (MXD-426 name and description).
 * - Dealer address: city "Banglore" -> "Bengaluru", and a district that just
 *   repeats the state ("Karnataka, Karnataka") -> "Bengaluru Urban".
 *
 * Every change is guarded: it only applies while the old text is still there,
 * so re-running is harmless and anything an admin has since edited by hand is
 * left alone. Banners are matched by their uploaded image, not by id.
 */
import 'dotenv/config';
import prisma from '../lib/prisma';

const OLD_SUBTITLE = 'surrounding sounds';

const BANNER_COPY = [
  {
    image: '/uploads/1790137644307-v56bxwju9b8.png', // black TWS earbuds in their case
    title: 'Wireless Earbuds Your Customers Will Love.',
    subtitle:
      'MXD true wireless earbuds with rich sound and clear calls, packed ready for your shelf and supplied to registered dealers at wholesale rates.',
  },
  {
    image: '/uploads/1790143226715-l8csdch2c9e.png', // dual-port charger + power bank
    title: 'Fast Chargers and Power Banks for Every Phone.',
    subtitle:
      'Dual-port wall chargers, car chargers and power banks from MXD, built for everyday fast charging and stocked in bulk for mobile accessory shops.',
  },
  {
    image: '/uploads/1790144291218-kqptrh355h.png', // charger, earbuds, power bank, cable, car holder
    title: 'Everything Your Accessory Shop Needs. One Supplier.',
    subtitle:
      'Chargers, cables, earbuds, neckbands, speakers, power banks and holders from MXD, ordered in one WhatsApp inquiry and delivered across Karnataka, Tamil Nadu and Andhra Pradesh.',
  },
];

async function fixBanners(): Promise<number> {
  let changed = 0;
  for (const b of BANNER_COPY) {
    const { count } = await prisma.banner.updateMany({
      where: { image: b.image, subtitle: OLD_SUBTITLE },
      data: { title: b.title, subtitle: b.subtitle },
    });
    if (count) console.log(`  ✓ banner → "${b.title}"`);
    changed += count;
  }
  return changed;
}

async function fixMagnetTypo(): Promise<number> {
  const products = await prisma.product.findMany({
    where: { OR: [{ name: { contains: 'Megnet' } }, { description: { contains: 'Megnet' } }] },
    select: { id: true, sku: true, name: true, description: true },
  });
  for (const p of products) {
    await prisma.product.update({
      where: { id: p.id },
      data: { name: p.name.replace(/Megnet/g, 'Magnet'), description: p.description?.replace(/Megnet/g, 'Magnet') },
    });
    console.log(`  ✓ ${p.sku}: "${p.name}" → "${p.name.replace(/Megnet/g, 'Magnet')}"`);
  }
  return products.length;
}

async function fixBengaluruAddresses(): Promise<number> {
  const dealers = await prisma.dealer.findMany({
    where: { city: { in: ['Banglore', 'banglore', 'BANGLORE'] } },
    select: { id: true, shopName: true, district: true, state: true },
  });
  for (const d of dealers) {
    const districtRepeatsState = d.district.trim().toLowerCase() === d.state.trim().toLowerCase();
    await prisma.dealer.update({
      where: { id: d.id },
      data: { city: 'Bengaluru', ...(districtRepeatsState && { district: 'Bengaluru Urban' }) },
    });
    console.log(`  ✓ ${d.shopName}: city → Bengaluru${districtRepeatsState ? ', district → Bengaluru Urban' : ''}`);
  }
  return dealers.length;
}

async function main() {
  console.log('Hero banners:');
  const banners = await fixBanners();
  console.log('Product names:');
  const products = await fixMagnetTypo();
  console.log('Dealer addresses:');
  const dealers = await fixBengaluruAddresses();
  console.log(`Done: ${banners} banner(s), ${products} product(s), ${dealers} dealer(s) updated. (0 = already fixed.)`);
}

if (require.main === module) {
  main()
    .catch((e) => { console.error('Content fix failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
