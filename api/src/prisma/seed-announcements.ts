/**
 * Announcement seed. Run: npx ts-node src/prisma/seed-announcements.ts
 *
 * Seeds the marquee messages that used to be hardcoded in web/app/page.tsx, so
 * the strip keeps showing them now that it is DB-driven (served by
 * routes/announcements.ts, managed via routes/admin/announcements.ts).
 */
import 'dotenv/config';
import prisma from '../lib/prisma';

// The messages that were previously hardcoded in web/app/page.tsx (MARQUEE_TEXT).
// Seeded once so the marquee keeps showing them after it switches to DB-driven content.
const MESSAGES = [
  'New Arrivals: iPhone 16 Accessories Now Available',
  'Free Delivery on Orders above ₹5,000',
  'Service Area: Karnataka | Tamil Nadu | Andhra Pradesh',
  'WhatsApp Inquiries Processed ASAP - As Fast as Possible',
  'MOQ as Low as 5 Units on Select Products',
];

async function main() {
  const count = await prisma.announcement.count();
  if (count > 0) {
    console.log(`Announcements already present (${count}). Skipping seed.`);
    return;
  }
  await prisma.announcement.createMany({
    data: MESSAGES.map((text, i) => ({ text, displayOrder: i, active: true })),
  });
  console.log(`Seeded ${MESSAGES.length} announcements.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
