/**
 * One-off content repair (2026-08-13): replace the placeholder hero carousel
 * copy ("Mxd", "test it", "New Products") with real dealer-facing messaging.
 *
 * Every claim used below already appears elsewhere on the site and was checked
 * against it — no new promises are introduced:
 *   - MOQ from 5 units        → announcement marquee + WhyChooseMXD
 *   - 12 categories           → live category count
 *   - order by 3 PM, same-day dispatch from Bengaluru → WhyChooseMXD
 *   - confirmation on WhatsApp the same business day  → HowItWorks
 *   - GST number + shop details, reviewed within 24h  → HowItWorks
 *   - Karnataka / Tamil Nadu / Andhra Pradesh service area → site-wide
 *
 * Only title, subtitle and (slide 3) the CTA are touched. Images, colours,
 * banner type, ordering and active state are left exactly as they are.
 * Backs up all three rows before writing.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const p = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: process.env.DATABASE_URL })) });

const COPY = [
  {
    id: 'cmqj7d1q40000hctgfb3req4i', // displayOrder 0 — positioning
    expect: 'Mxd',
    data: {
      title: 'Wholesale Mobile Accessories. MOQ From 5 Units.',
      subtitle:
        'Chargers, cables, earphones, power banks and more across 12 categories — dealer pricing for registered retailers in Karnataka, Tamil Nadu and Andhra Pradesh.',
    },
  },
  {
    id: 'cmqj7dno30001hctg1n61vtkw', // displayOrder 1 — logistics
    expect: 'test it',
    data: {
      title: 'Order by 3 PM. Dispatched the Same Day.',
      subtitle:
        'Shipped from our Bengaluru warehouse to dealers across South India, with pricing and availability confirmed on WhatsApp the same business day.',
    },
  },
  {
    id: 'cmqjltuur0000fctg73zx6f23', // displayOrder 2 — registration
    expect: 'New Products',
    data: {
      title: 'Dealer Pricing, Unlocked in About Two Minutes.',
      subtitle:
        'Register with your GST number and basic shop details. Most applications are reviewed within 24 hours.',
      ctaText: 'Register as a Dealer',
      ctaLink: '/register',
    },
  },
];

(async () => {
  const before = await p.banner.findMany({ where: { id: { in: COPY.map((c) => c.id) } } });
  const backupPath = path.join(__dirname, `_backup_herocopy_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(before, null, 2));
  console.log('backup written ->', backupPath);

  for (const c of COPY) {
    const row = before.find((b) => b.id === c.id);
    if (!row) { console.log(`SKIP ${c.id} — row not found`); continue; }
    if (row.title !== c.expect) {
      console.log(`SKIP ${c.id} — title is ${JSON.stringify(row.title)}, expected ${JSON.stringify(c.expect)}. Not overwriting edited copy.`);
      continue;
    }
    await p.banner.update({ where: { id: c.id }, data: c.data });
    console.log(`updated ${JSON.stringify(c.expect)} -> ${JSON.stringify(c.data.title)}`);
  }

  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
