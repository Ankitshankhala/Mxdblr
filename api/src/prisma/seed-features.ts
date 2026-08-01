/**
 * Product features seed. Run: npx ts-node src/prisma/seed-features.ts
 *
 * Populates the ProductFeature master list — the central catalogue of supported
 * technologies (fast-charge standards, wireless, cable types, data speeds,
 * protections, certifications) that products reference by slug instead of each
 * uploading a duplicate logo. Idempotent (upsert by slug), so re-running is safe
 * and adds any newly listed features without disturbing existing links.
 *
 * `logo` points at web/public/product-features/<slug>.svg. Those are currently
 * neutral labeled placeholders (NOT official brand art) — swap in the real
 * Qualcomm / OPPO VOOC / Samsung etc. logos via Admin → Features before launch.
 */
import 'dotenv/config';
import prisma from '../lib/prisma';

type FeatureSeed = {
  name: string;
  slug: string;
  category: 'CHARGING' | 'WIRELESS' | 'CABLE' | 'DATA' | 'PROTECTION' | 'CERTIFICATION';
  description: string;
};

// displayOrder is assigned per-category from array position below.
const FEATURES: FeatureSeed[] = [
  // ── Charging technologies ───────────────────────────────────────────────────
  { name: 'Qualcomm Quick Charge', slug: 'quick-charge', category: 'CHARGING',
    description: 'Compatible with QC 2.0, QC 3.0 and QC 4.0 devices for rapid charging.' },
  { name: 'Power Delivery', slug: 'usb-pd', category: 'CHARGING',
    description: 'USB Power Delivery (USB-PD) up to 100W+ over USB-C.' },
  { name: 'PPS', slug: 'pps', category: 'CHARGING',
    description: 'Programmable Power Supply — fine-grained voltage stepping for cooler, faster charging.' },
  { name: 'SuperVOOC', slug: 'supervooc', category: 'CHARGING',
    description: 'OPPO / OnePlus SuperVOOC ultra-fast charging.' },
  { name: 'VOOC', slug: 'vooc', category: 'CHARGING',
    description: 'OPPO VOOC flash-charge technology.' },
  { name: 'Dash Charge', slug: 'dash-charge', category: 'CHARGING',
    description: 'OnePlus Dash Charge fast charging.' },
  { name: 'Warp Charge', slug: 'warp-charge', category: 'CHARGING',
    description: 'OnePlus Warp Charge 30/65 fast charging.' },
  { name: 'Dart Charge', slug: 'dart-charge', category: 'CHARGING',
    description: 'realme Dart Charge fast charging.' },
  { name: 'Flash Charge', slug: 'flash-charge', category: 'CHARGING',
    description: 'vivo FlashCharge fast charging.' },
  { name: 'Samsung Super Fast Charging', slug: 'samsung-sfc', category: 'CHARGING',
    description: 'Samsung Super Fast Charging (25W/45W) via USB-PD PPS.' },
  { name: 'Adaptive Fast Charging', slug: 'afc', category: 'CHARGING',
    description: 'Samsung Adaptive Fast Charging (AFC) for older Galaxy devices.' },
  { name: 'Huawei SuperCharge', slug: 'huawei-sc', category: 'CHARGING',
    description: 'Huawei SuperCharge fast charging.' },
  { name: 'Mi Turbo Charge', slug: 'mi-turbo', category: 'CHARGING',
    description: 'Xiaomi Mi Turbo Charge fast charging.' },
  { name: 'TurboPower', slug: 'turbopower', category: 'CHARGING',
    description: 'Motorola TurboPower fast charging.' },

  // ── Wireless charging ───────────────────────────────────────────────────────
  { name: 'Qi Wireless Charging', slug: 'qi', category: 'WIRELESS',
    description: 'WPC Qi-certified wireless charging.' },
  { name: 'MagSafe', slug: 'magsafe', category: 'WIRELESS',
    description: 'Apple MagSafe magnetic wireless charging up to 15W.' },

  // ── Cable features ──────────────────────────────────────────────────────────
  { name: 'USB-C', slug: 'usb-c', category: 'CABLE',
    description: 'Reversible USB Type-C connector.' },
  { name: 'Lightning', slug: 'lightning', category: 'CABLE',
    description: 'Apple Lightning connector for iPhone / iPad.' },
  { name: 'Micro USB', slug: 'micro-usb', category: 'CABLE',
    description: 'Micro-USB Type-B connector.' },
  { name: 'Thunderbolt', slug: 'thunderbolt', category: 'CABLE',
    description: 'Thunderbolt 3 / 4 over USB-C — up to 40 Gbps.' },
  { name: 'USB 3.0', slug: 'usb-3-0', category: 'CABLE',
    description: 'USB 3.0 (SuperSpeed) — up to 5 Gbps.' },
  { name: 'USB 3.1', slug: 'usb-3-1', category: 'CABLE',
    description: 'USB 3.1 Gen 2 — up to 10 Gbps.' },
  { name: 'USB 4', slug: 'usb-4', category: 'CABLE',
    description: 'USB4 — up to 40 Gbps, Thunderbolt-compatible.' },

  // ── Data transfer speeds ────────────────────────────────────────────────────
  { name: '480 Mbps', slug: 'data-480mbps', category: 'DATA',
    description: 'USB 2.0 High-Speed data transfer — 480 Mbps.' },
  { name: '5 Gbps', slug: 'data-5gbps', category: 'DATA',
    description: 'USB 3.0 SuperSpeed data transfer — 5 Gbps.' },
  { name: '10 Gbps', slug: 'data-10gbps', category: 'DATA',
    description: 'USB 3.1 Gen 2 data transfer — 10 Gbps.' },
  { name: '20 Gbps', slug: 'data-20gbps', category: 'DATA',
    description: 'USB 3.2 Gen 2x2 data transfer — 20 Gbps.' },
  { name: '40 Gbps', slug: 'data-40gbps', category: 'DATA',
    description: 'Thunderbolt / USB4 data transfer — 40 Gbps.' },

  // ── Protection ──────────────────────────────────────────────────────────────
  { name: 'Over Voltage Protection', slug: 'ovp', category: 'PROTECTION',
    description: 'Cuts power if input voltage exceeds safe limits.' },
  { name: 'Over Current Protection', slug: 'ocp', category: 'PROTECTION',
    description: 'Limits current draw to protect the device battery.' },
  { name: 'Short Circuit Protection', slug: 'scp', category: 'PROTECTION',
    description: 'Shuts down on a detected short circuit.' },
  { name: 'Temperature Protection', slug: 'otp', category: 'PROTECTION',
    description: 'Throttles or halts charging when the device overheats.' },

  // ── Certifications ──────────────────────────────────────────────────────────
  { name: 'CE', slug: 'ce', category: 'CERTIFICATION',
    description: 'CE marked — conforms to EU health, safety and environmental standards.' },
  { name: 'FCC', slug: 'fcc', category: 'CERTIFICATION',
    description: 'FCC certified for the US market.' },
  { name: 'RoHS', slug: 'rohs', category: 'CERTIFICATION',
    description: 'RoHS compliant — restriction of hazardous substances.' },
  { name: 'BIS', slug: 'bis', category: 'CERTIFICATION',
    description: 'BIS certified for sale in India.' },
];

async function main() {
  console.log('Seeding product features...');

  // Assign displayOrder sequentially within each category for stable card ordering.
  const perCategoryCount: Record<string, number> = {};

  let upserted = 0;
  for (const f of FEATURES) {
    const order = (perCategoryCount[f.category] = (perCategoryCount[f.category] ?? 0) + 1) - 1;
    await prisma.productFeature.upsert({
      where: { slug: f.slug },
      update: {
        name: f.name,
        category: f.category,
        description: f.description,
        logo: `/product-features/${f.slug}.svg`,
        displayOrder: order,
      },
      create: {
        name: f.name,
        slug: f.slug,
        category: f.category,
        description: f.description,
        logo: `/product-features/${f.slug}.svg`,
        displayOrder: order,
        active: true,
      },
    });
    upserted++;
  }

  console.log(`✓ Product features: ${upserted} upserted across 6 categories.`);
  console.log('Note: logos are neutral placeholders — replace with official brand art via Admin → Features.');
}

main()
  .catch((e) => { console.error('Feature seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
