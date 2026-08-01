/**
 * MXD Catalog Seed — populates all 12 categories and 59 products
 * Run: npx ts-node src/prisma/seed-catalog.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CATEGORIES = [
  { name: 'Headphones',       slug: 'headphones',       displayOrder: 1,  description: 'Over-ear and on-ear headphones for personal and professional use' },
  { name: 'Earphones',        slug: 'earphones',        displayOrder: 2,  description: 'Wired earphones with 3.5mm jack and USB-C connectivity' },
  { name: 'Speakers',         slug: 'speakers',         displayOrder: 3,  description: 'Bluetooth and wired speakers for home and outdoor use' },
  { name: 'Power Banks',      slug: 'power-banks',      displayOrder: 4,  description: 'Portable power banks from 10000mAh to 25000mAh' },
  { name: 'Chargers',         slug: 'chargers',         displayOrder: 5,  description: 'Fast chargers from 20W to 85W with multi-protocol support' },
  { name: 'Phone Cases',      slug: 'phone-cases',      displayOrder: 6,  description: 'Protective flip covers and cases for all major phone brands' },
  { name: 'Stands & Holders', slug: 'stands-holders',   displayOrder: 7,  description: 'Car phone mounts, desk stands and tablet holders' },
  { name: 'AirPods',          slug: 'airpods',          displayOrder: 8,  description: 'True wireless stereo earbuds with Bluetooth 5.3 and 5.4' },
  { name: 'Smart Watches',    slug: 'smart-watches',    displayOrder: 9,  description: 'Affordable smart watches with health and fitness tracking' },
  { name: 'Microphones',      slug: 'microphones',      displayOrder: 10, description: 'Wireless karaoke microphones and HiFi speakers' },
  { name: 'Mobile Batteries', slug: 'mobile-batteries', displayOrder: 11, description: 'Replacement Li-Ion batteries for mobile phones' },
  { name: 'Data Cables',      slug: 'data-cables',      displayOrder: 12, description: 'USB-C, Micro, Lightning and AUX cables with fast charging' },
];

const CAT_MAP: Record<string, string> = {
  'Head Phone':     'headphones',
  'Ear Phone':      'earphones',
  'Speaker':        'speakers',
  'Power Bank':     'power-banks',
  'Charger':        'chargers',
  'Phone Case':     'phone-cases',
  'Stand & Holder': 'stands-holders',
  'AirPods':        'airpods',
  'Smart Watch':    'smart-watches',
  'Microphone':     'microphones',
  'Mobile Battery': 'mobile-batteries',
  'Data Cable':     'data-cables',
};

const PRODUCTS = [
  { sku: 'MXD-386',         name: 'MXD 386 HF',         cat: 'Head Phone',     moq: 10, desc: 'MXD-386 HF - 360° SURROUND STEREO SOUND, ERGONOMIC WEARING, SUPER INTELLIGENT VOICE, 6 HOURS TALK TIME, CHARGES IN 120 MINUTES.' },
  { sku: 'MXD-395',         name: 'MXD-395',             cat: 'Head Phone',     moq: 10, desc: 'MXD-395 HEADPHONE — CLEAR SOUND AND HEAVEN BEATS. WIRELESS HEADPHONE.' },
  { sku: 'MXD-M8',          name: 'MXD-M8',              cat: 'Ear Phone',      moq: 10, desc: '10MM SPEAKER FOR DEEP BASS AND CLEAR SOUND. 100mW POWER OUTPUT, 3.5MM JACK, 1200MM CABLE.' },
  { sku: 'MXD-510',         name: 'MXD-510 Earphone',    cat: 'Ear Phone',      moq: 10, desc: 'EASY TO USE EARPHONES. SOUND CLARITY AND PROPER WORKING EARPHONE.' },
  { sku: 'MXD-757',         name: 'MXD-757',             cat: 'Ear Phone',      moq: 10, desc: '10MM SPEAKER, TYPE C INTERFACE, 1200MM WIRE LENGTH. SLEEK BLACK.' },
  { sku: 'MXD-760',         name: 'MXD-760',             cat: 'Ear Phone',      moq: 10, desc: 'CRISP AUDIO. 10MM SPEAKER, 1200MM WIRE, UNIVERSAL COMPATIBILITY.' },
  { sku: 'MXD-505',         name: 'MXD-505',             cat: 'Ear Phone',      moq: 10, desc: 'NATURALLY THE EAR CANAL, LIGHT AND STURDY. STEREO SOUND QUALITY. 1200MM WIRE LENGTH.' },
  { sku: 'MXD-768',         name: 'MXD-768',             cat: 'Ear Phone',      moq: 10, desc: 'METAL STEREO, POWERFUL BASS WITH MAGNETIC BUDS. 3.5MM PLUG, 10MM SPEAKER.' },
  { sku: 'MXD-517',         name: 'MXD-517',             cat: 'Ear Phone',      moq: 10, desc: 'BOOMING BASS. 10MM SPEAKER, BUILT-IN MIC, 3.5 JACK, 1200MM WIRE.' },
  { sku: 'MXD-508',         name: 'MXD-508',             cat: 'Ear Phone',      moq: 10, desc: '100mW WORKING POWER, 3.5MM JACK. HI-FI STEREO WITH BUILT-IN MIC.' },
  { sku: 'MXD-506',         name: 'MXD-506',             cat: 'Ear Phone',      moq: 10, desc: '3.5MM JACK. NOISE ISOLATION PREMIUM QUALITY. DEEP BASS AND CLEAR SOUND.' },
  { sku: 'MXD-M113',        name: 'MXD-M113',            cat: 'Ear Phone',      moq: 10, desc: 'BOX EARPHONE — GOOD SOUND AND BEST PRICE TO AFFORD.' },
  { sku: 'MXD-879-TS',      name: 'MXD-879 TS',          cat: 'Speaker',        moq: 5,  desc: 'DJ TOWER MULTIMEDIA SPEAKER. 150W P.M.P.D, REMOTE CONTROLLER, PLUG & PLAY WITH EXTRA BASS.' },
  { sku: 'MXD-878-TS',      name: 'MXD-878 TS',          cat: 'Speaker',        moq: 5,  desc: '150W TOWER SPEAKER WITH LED LIGHT. REMOTE, AUX IN, FM-RADIO, BLUETOOTH 5.0.' },
  { sku: 'MXD-898',         name: 'MXD-898',             cat: 'Speaker',        moq: 5,  desc: '5W RMS. USB CHARGEABLE. 4HR BATTERY LIFE. BLUETOOTH 5.0. 10M WIRELESS RANGE.' },
  { sku: 'MXD-816',         name: 'MXD-816 Rock Music',  cat: 'Speaker',        moq: 5,  desc: '12 HOURS PLAYBACK. 25W V5.3 WIRELESS SPEAKER. TYPE-C CHARGE. TF CARD, USB, AUX.' },
  { sku: 'MXD-817',         name: 'MXD-817',             cat: 'Speaker',        moq: 5,  desc: 'MXD-817 TROLLY SPEAKER.' },
  { sku: 'MXD-815',         name: 'MXD-815',             cat: 'Speaker',        moq: 5,  desc: 'MXD-815 SPACE BEAT SPEAKER — HIGHER QUALITY PRODUCT.' },
  { sku: 'MXD-PB570',       name: 'MXD-PB570',           cat: 'Power Bank',     moq: 10, desc: 'MAGNETIC WIRELESS 10000mAh. 35W MULTI DEVICE. QUICK CHARGE WIRELESS. SMART CHIP.' },
  { sku: 'MXD-567',         name: 'MXD-567',             cat: 'Power Bank',     moq: 10, desc: '12000mAh POWER BANK.' },
  { sku: 'MXD-569',         name: 'MXD-569',             cat: 'Power Bank',     moq: 10, desc: '25000mAh 22.5W FAST CHARGE POWER BANK. 6 MONTH WARRANTY.' },
  { sku: 'MXD-CH173',       name: 'MXD-CH173',           cat: 'Charger',        moq: 10, desc: '2.8A OUTPUT MOBILE CHARGER. HIGH QUALITY PURE COPPER CHIP, OVER VOLTAGE PROTECTION.' },
  { sku: 'MXD-CH281',       name: 'MXD-CH281',           cat: 'Charger',        moq: 10, desc: '20W POWER SUPPORT, SINGLE USB PORT, 9S PROTECTION FOR SAFE CHARGING.' },
  { sku: 'MXD-CH276',       name: 'MXD-CH 276',          cat: 'Charger',        moq: 10, desc: '85W OUTPUT, MULTI-PROTOCOL SUPPORT, 9S PROTECTION, AUTO ID CHIP.' },
  { sku: 'MXD-CH251',       name: 'MXD-CH 251 Speed',    cat: 'Charger',        moq: 10, desc: '20W OUTPUT COMPACT CHARGER. MULTI PROTOCOL SUPPORT.' },
  { sku: 'MXD-CH256',       name: 'MXD-CH256 Speed',     cat: 'Charger',        moq: 10, desc: '20W FAST CHARGING, MULTI-PROTECTION, AUTO ID CHIP TECHNOLOGY.' },
  { sku: 'MXD-277',         name: 'MXD-277',             cat: 'Charger',        moq: 10, desc: 'FAST CHARGING AND AFFORDABLE PRICE.' },
  { sku: 'MXD-FLIP-COVER',  name: 'MXD Flip Cover',      cat: 'Phone Case',     moq: 20, desc: 'AMAZING FITTING & LOOKING SO BRIGHTLY.' },
  { sku: 'MXD-ST889',       name: 'MXD-ST 889',          cat: 'Stand & Holder', moq: 10, desc: 'CAR MOBILE HOLDER. 360° ROTATION. COMPATIBLE WITH DEVICES 4 TO 6 INCHES.' },
  { sku: 'MXD-ST983',       name: 'MXD-ST983',           cat: 'Stand & Holder', moq: 10, desc: 'ALUMINIUM ALLOY BASE BRACKET. CONVENIENT CHARGING FOR TABLET & SMARTPHONE. SILVER.' },
  { sku: 'MXD-956',         name: 'MXD-956',             cat: 'Stand & Holder', moq: 10, desc: 'MXD-956 STAND.' },
  { sku: 'MXD-955',         name: 'MXD-955',             cat: 'Stand & Holder', moq: 10, desc: 'MXD-955 STAND.' },
  { sku: 'MXD-954',         name: 'MXD-954',             cat: 'Stand & Holder', moq: 10, desc: 'AFFORDABLE PRICE AND HIGH QUALITY PRODUCT.' },
  { sku: 'MXD-977',         name: 'MXD-977',             cat: 'Stand & Holder', moq: 10, desc: 'CAR PHONE BRACKET.' },
  { sku: 'MXD-982',         name: 'MXD-982',             cat: 'Stand & Holder', moq: 10, desc: 'MOBILE PHONE HOLDER — HIGH FITNESS / STABLE WITHOUT SHAKING.' },
  { sku: 'MXD-981',         name: 'MXD-981',             cat: 'Stand & Holder', moq: 10, desc: 'CAR HOLDER — EASY USE AND STABILITY.' },
  { sku: 'MXD-390',         name: 'MXD-390',             cat: 'AirPods',        moq: 10, desc: 'WIRELESS V5.4. BLUETOOTH UP TO 10M. 5 HOURS MUSIC, 6 HOURS TALK. QUICK 90-MIN TYPE-C CHARGING.' },
  { sku: 'MXD-AP369',       name: 'MXD-AP369',           cat: 'AirPods',        moq: 10, desc: 'WIRELESS V5.3. BLUETOOTH UP TO 12M. 90-MIN TYPE-C CHARGING. 300mAh. HD VOICE.' },
  { sku: 'MXD-391',         name: 'MXD-391',             cat: 'AirPods',        moq: 10, desc: 'WIRELESS V5.4. 35 HOURS MUSIC TIME. BLUETOOTH UP TO 10M.' },
  { sku: 'MXD-BT385',       name: 'MXD-BT385',           cat: 'AirPods',        moq: 10, desc: 'WIRELESS ROCKBUDS V5.3. 6 HOURS MUSIC & 5 HOURS TALK. TOUCH CONTROL. 90 MIN TYPE-C.' },
  { sku: 'MXD-396',         name: 'MXD-396',             cat: 'AirPods',        moq: 10, desc: 'EASY TOUCH FUNCTIONS. UP TO 5 HOURS OF MUSIC. HALL SWITCH FUNCTIONS.' },
  { sku: 'MXD-864',         name: 'MXD-864',             cat: 'AirPods',        moq: 10, desc: 'GOOD SOUND QUALITY AND AFFORDABLE PRICE.' },
  { sku: 'MXD-452',         name: 'MXD 452',             cat: 'Smart Watch',    moq: 5,  desc: 'AMAZING DISPLAY & PERFECT DESIGN.' },
  { sku: 'MXD-811',         name: 'MXD-811 HI-FI',       cat: 'Microphone',     moq: 5,  desc: '15W WIRELESS SPEAKER. HI-FI & SING SONG. MIC ON/OFF AND REMIX SYSTEM.' },
  { sku: 'MXD-902PRO',      name: 'MXD-902PRO',          cat: 'Microphone',     moq: 5,  desc: 'WIRELESS SPEAKER, HI-FI. SING A SONG. HEAR CLEARLY AT A DISTANCE.' },
  { sku: 'MXD-BN56',        name: 'MXD-BN 56',           cat: 'Mobile Battery', moq: 10, desc: 'BATTERY CAPACITY IS VERY NICE. GOOD PERFORMANCE.' },
  { sku: 'MXD-X-SERIES',    name: 'MXD-X Series',        cat: 'Mobile Battery', moq: 10, desc: 'RECHARGEABLE LI-ION POLYMER. CELL TEMPERATURE PROTECTION. DOUBLE SHORT CIRCUIT PROTECTION.' },
  { sku: 'MXD-LI-ION-GOLD', name: 'MXD Li-Ion Gold',     cat: 'Mobile Battery', moq: 10, desc: 'SMD & DOUBLE IC CONTROL PCB. OVER LOADED PROTECTION. CONTROL SWITCHES.' },
  { sku: 'MXD-DC407',       name: 'MXD-DC407',           cat: 'Data Cable',     moq: 10, desc: 'USB 3.1 A SYNC. 1M CABLE. 5V-3.1A. SUPER COMPATIBLE. FAST TRANSMISSION, ANTI-WINDING.' },
  { sku: 'MXD-DC614',       name: 'MXD-DC614',           cat: 'Data Cable',     moq: 10, desc: 'TYPE-C CONNECTIVITY. 45W OUTPUT. MICRO, TYPE-C & LIGHTNING. ANTI-KNOTTED.' },
  { sku: 'MXD-DC410',       name: 'MXD DC410',           cat: 'Data Cable',     moq: 10, desc: '3-IN-1 USB CABLE: 18W OUTPUT, 1200MM. TYPE-C, MICRO, AND LIGHTNING. FAST CHARGING.' },
  { sku: 'MXD-DC674',       name: 'MXD-DC674',           cat: 'Data Cable',     moq: 10, desc: 'TYPE-C WITH 85W OUTPUT. FAST CHARGING. WITHSTANDS 10,000+ BENDS. 6MM THICK, 1000MM LONG.' },
  { sku: 'MXD-DC661',       name: 'MXD-DC661',           cat: 'Data Cable',     moq: 10, desc: '65W OUTPUT. TYPE-C CONNECTIVITY. FAST CHARGING SUPPORTED.' },
  { sku: 'MXD-DC653',       name: 'MXD-DC653',           cat: 'Data Cable',     moq: 10, desc: 'ANDROID MICRO USB. 4.1A MAX OUTPUT. HIGH QUALITY CONNECTOR, ANTI-RUST PLUG.' },
  { sku: 'MXD-720',         name: 'MXD-720',             cat: 'Data Cable',     moq: 10, desc: 'MXD-720 DATA CABLE.' },
  { sku: 'MXD-605',         name: 'MXD-605 AUX Cable',   cat: 'Data Cable',     moq: 10, desc: 'MXD-605 AUX CABLE.' },
  { sku: 'MXD-718',         name: 'MXD-718',             cat: 'Data Cable',     moq: 10, desc: 'MXD-718 DATA CABLE.' },
  { sku: 'MXD-601',         name: 'MXD-601 AUX Cable',   cat: 'Data Cable',     moq: 10, desc: 'MXD-601 AUX CABLE.' },
];

async function main() {
  console.log('🌱 Seeding MXD catalog...\n');

  // 1. Upsert categories
  console.log('📂 Categories:');
  const catIdMap: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    const result = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, displayOrder: cat.displayOrder, active: true, description: cat.description },
      create: { name: cat.name, slug: cat.slug, displayOrder: cat.displayOrder, active: true, description: cat.description },
    });
    catIdMap[cat.slug] = result.id;
    console.log(`  ✓ ${cat.name}`);
  }

  // 2. Upsert products
  console.log(`\n📦 Products (${PRODUCTS.length} total):`);
  let created = 0, updated = 0, failed = 0;
  for (const p of PRODUCTS) {
    const catSlug = CAT_MAP[p.cat];
    const categoryId = catSlug ? catIdMap[catSlug] : undefined;
    try {
      const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
      if (existing) {
        await prisma.product.update({
          where: { sku: p.sku },
          data: { name: p.name, description: p.desc, moq: p.moq, ...(categoryId && { categoryId }) },
        });
        updated++;
      } else {
        await prisma.product.create({
          data: { name: p.name, brand: 'MXD', sku: p.sku, description: p.desc, moq: p.moq, stockStatus: 'IN_STOCK', stockQty: 100, images: [],...(categoryId && { categoryId }) },
        });
        created++;
      }
      console.log(`  ✓ [${p.sku}] ${p.name}`);
    } catch (e: any) {
      console.error(`  ✗ [${p.sku}] ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Done:`);
  console.log(`   Categories: ${CATEGORIES.length}`);
  console.log(`   Products created: ${created}, updated: ${updated}, failed: ${failed}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
