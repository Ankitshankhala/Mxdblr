/**
 * MXD web-catalog import. Run: npx ts-node src/prisma/seed-mxd-catalog.ts
 *
 * Imports the 101 products in catalog-assets/products.csv and their images from
 * catalog-assets/images/ (the web-optimised webp set — ~93KB average, versus
 * ~425KB for the originals; these are served straight off this box with no CDN,
 * so the smaller set is the one that ships).
 *
 * Idempotent: products are upserted by SKU and images are only copied when absent
 * or a different size, so re-running is safe and cheap.
 *
 * Images are copied into api/uploads/ and stored as RELATIVE "/uploads/<file>"
 * paths — never an absolute host. normalizeImageUrl() on the frontend resolves
 * them against the public API origin at render time, which is what lets the same
 * row work on localhost and on api.mxdblr.com (see lib/cloudinary.ts, CRIT-6).
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';

// ── CSV parsing ──────────────────────────────────────────────────────────────
// Descriptions contain commas AND double quotes, so a naive split(',') corrupts
// every row after the first quoted field. This is a minimal RFC-4180 reader:
// quoted fields may contain commas, newlines and "" escapes.
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const headers = rows.shift() || [];
  return rows
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

// ── Category mapping ─────────────────────────────────────────────────────────
// The CSV uses singular trade names; the storefront uses plural category names.
// Neckbands / Adapters / Pen Drives do not exist yet and are created, per the
// decision to keep them distinct rather than folding them into Earphones and
// Chargers where dealers browsing those categories would meet unrelated stock.
const CATEGORY_MAP: Record<string, string> = {
  'Charger': 'Chargers',
  'Data Cable': 'Data Cables',
  'Speaker': 'Speakers',
  'Ear Phone': 'Earphones',
  'AirPods': 'AirPods',
  'Microphone': 'Microphones',
  'Stand & Holder': 'Stands & Holders',
  'Power Bank': 'Power Banks',
  'Neckband': 'Neckbands',
  'Adapter': 'Adapters',
  'Pen Drive': 'Pen Drives',
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  const assetDir = path.join(__dirname, 'catalog-assets');
  const csvPath = path.join(assetDir, 'products.csv');
  const imgDir = path.join(assetDir, 'images');
  const uploadsDir = path.join(process.cwd(), 'uploads');

  if (!fs.existsSync(csvPath)) throw new Error(`Missing ${csvPath}`);
  fs.mkdirSync(uploadsDir, { recursive: true });

  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
  console.log(`Parsed ${rows.length} rows from products.csv`);

  // Fail before writing anything if the CSV names a category we have no rule for.
  const unmapped = [...new Set(rows.map((r) => r.category))].filter((c) => c && !CATEGORY_MAP[c]);
  if (unmapped.length) throw new Error(`Unmapped categories: ${unmapped.join(', ')}`);

  // Categories first — products reference them.
  const categoryIds = new Map<string, string>();
  for (const appName of new Set(Object.values(CATEGORY_MAP))) {
    const cat = await prisma.category.upsert({
      where: { slug: slugify(appName) },
      update: {},
      create: { name: appName, slug: slugify(appName) },
    });
    categoryIds.set(appName, cat.id);
  }
  console.log(`✓ ${categoryIds.size} categories ready`);

  let created = 0, updated = 0, imagesCopied = 0, missingImages = 0;

  for (const r of rows) {
    const sku = (r.name || '').trim();
    if (!sku) continue;

    // Copy the image into uploads/ and record it as a relative path.
    const images: string[] = [];
    const file = (r.image_files || '').trim();
    if (file) {
      const src = path.join(imgDir, file);
      if (fs.existsSync(src)) {
        const dest = path.join(uploadsDir, file);
        if (!fs.existsSync(dest) || fs.statSync(dest).size !== fs.statSync(src).size) {
          fs.copyFileSync(src, dest);
          imagesCopied++;
        }
        images.push(`/uploads/${file}`);
      } else {
        missingImages++;
        console.warn(`  ! image not found for ${sku}: ${file}`);
      }
    }

    const categoryId = categoryIds.get(CATEGORY_MAP[r.category]) ?? null;
    const existing = await prisma.product.findUnique({ where: { sku }, select: { id: true } });

    // Price stays null / pricingActive false: the CSV carries no pricing, and
    // this is a dealer-inquiry catalogue where prices are quoted over WhatsApp.
    const data = {
      name: sku,
      brand: 'MXD',
      description: r.description || null,
      categoryId,
      ...(images.length ? { images } : {}),
    };

    await prisma.product.upsert({
      where: { sku },
      update: data,
      create: { sku, ...data },
    });
    existing ? updated++ : created++;
  }

  console.log(`✓ products: ${created} created, ${updated} updated`);
  console.log(`✓ images: ${imagesCopied} copied into uploads/ (${missingImages} missing)`);

  const totals = {
    products: await prisma.product.count(),
    categories: await prisma.category.count(),
  };
  console.log(`DB now holds ${totals.products} products across ${totals.categories} categories`);
}

// Only run when executed directly. Without this guard, importing parseCSV for a
// test would silently run the whole import against whatever DATABASE_URL is set.
if (require.main === module) {
  main()
    .catch((e) => { console.error('Import failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
