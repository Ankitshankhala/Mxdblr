/**
 * Events seed. Run: npx ts-node src/prisma/seed-events.ts
 *
 * Seeds a few sample "Events & Activities" so the homepage section and the admin
 * module have content during testing. Images use picsum.photos placeholders (demo
 * only — replace with real uploads via Admin → Events). Skips if events exist.
 */
import 'dotenv/config';
import prisma from '../lib/prisma';
import { parseVideoUrl } from '../lib/video';

const EVENTS = [
  {
    title: 'MXD Dealer Meet 2026 — Bengaluru',
    description:
      'Our flagship annual dealer meet brought together 200+ retail partners from across South India for product previews, networking, and the unveiling of our 2026 accessory line-up.',
    category: 'DEALER_MEETUP' as const,
    eventDate: new Date('2026-06-15'),
    location: 'Bengaluru, Karnataka',
    coverImage: 'https://picsum.photos/seed/mxd-meet-cover/1200/800',
    images: [
      'https://picsum.photos/seed/mxd-meet-1/1200/800',
      'https://picsum.photos/seed/mxd-meet-2/1200/800',
      'https://picsum.photos/seed/mxd-meet-3/1200/800',
    ],
    videos: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    published: true,
    featured: true,
    displayOrder: 0,
  },
  {
    title: 'TWS Pro Series Launch',
    description:
      'Hands-on launch event for the new MXD TWS Pro earbuds range — live demos, dealer-exclusive intro pricing, and bulk pre-booking.',
    category: 'PRODUCT_LAUNCH' as const,
    eventDate: new Date('2026-05-20'),
    location: 'Bengaluru, Karnataka',
    coverImage: 'https://picsum.photos/seed/mxd-launch-cover/1200/800',
    images: [
      'https://picsum.photos/seed/mxd-launch-1/1200/800',
      'https://picsum.photos/seed/mxd-launch-2/1200/800',
    ],
    videos: [] as string[],
    published: true,
    featured: false,
    displayOrder: 1,
  },
  {
    title: 'Retail Partner Training Program',
    description:
      'A practical session on product knowledge, warranty handling, and in-store merchandising for our dealer network.',
    category: 'TRAINING' as const,
    eventDate: new Date('2026-04-10'),
    location: 'Mysuru, Karnataka',
    coverImage: 'https://picsum.photos/seed/mxd-training-cover/1200/800',
    images: ['https://picsum.photos/seed/mxd-training-1/1200/800'],
    videos: [] as string[],
    published: true,
    featured: false,
    displayOrder: 2,
  },
  {
    title: 'Mobile Accessories Expo — Chennai',
    description:
      'MXD exhibited its full catalogue at the South India Mobile Accessories Expo, connecting with new wholesale partners across Tamil Nadu.',
    category: 'EXHIBITION' as const,
    eventDate: new Date('2026-03-05'),
    location: 'Chennai, Tamil Nadu',
    coverImage: 'https://picsum.photos/seed/mxd-expo-cover/1200/800',
    images: [
      'https://picsum.photos/seed/mxd-expo-1/1200/800',
      'https://picsum.photos/seed/mxd-expo-2/1200/800',
    ],
    videos: [] as string[],
    published: true,
    featured: false,
    displayOrder: 3,
  },
];

async function main() {
  const count = await prisma.event.count();
  if (count > 0) {
    console.log(`Events already present (${count}). Skipping seed.`);
    return;
  }
  for (const e of EVENTS) {
    await prisma.event.create({
      data: {
        ...e,
        videos: e.videos.map((url) => parseVideoUrl(url)) as object,
      },
    });
  }
  console.log(`Seeded ${EVENTS.length} events.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
