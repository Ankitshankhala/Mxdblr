import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_ROLES, SUPER_ADMIN_ROLE } from '../lib/rbac';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// ── CSV parser ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { field += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === ',' && !inQuote) {
      fields.push(field); field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

function parseCSV(text: string): Record<string, string>[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') inQuote = !inQuote;
    if (ch === '\n' && !inQuote) { lines.push(current); current = ''; }
    else { current += ch; }
  }
  if (current.trim()) lines.push(current);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim(); });
    return row;
  });
}

// ── Category mapping ─────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, { name: string; slug: string; displayOrder: number }> = {
  'Head Phone':     { name: 'Headphones',      slug: 'headphones',       displayOrder: 1 },
  'Ear Phone':      { name: 'Earphones',        slug: 'earphones',        displayOrder: 2 },
  'Speaker':        { name: 'Speakers',         slug: 'speakers',         displayOrder: 3 },
  'Power Bank':     { name: 'Power Banks',      slug: 'power-banks',      displayOrder: 4 },
  'Charger':        { name: 'Chargers',         slug: 'chargers',         displayOrder: 5 },
  'Phone Case':     { name: 'Phone Cases',      slug: 'phone-cases',      displayOrder: 6 },
  'Stand & Holder': { name: 'Stands & Holders', slug: 'stands-holders',   displayOrder: 7 },
  'AirPods':        { name: 'AirPods',          slug: 'airpods',          displayOrder: 8 },
  'Smart Watch':    { name: 'Smart Watches',    slug: 'smart-watches',    displayOrder: 9 },
  'Microphone':     { name: 'Microphones',      slug: 'microphones',      displayOrder: 10 },
  'Mobile Battery': { name: 'Mobile Batteries', slug: 'mobile-batteries', displayOrder: 11 },
  'Data Cable':     { name: 'Data Cables',      slug: 'data-cables',      displayOrder: 12 },
};

function toSku(name: string): string {
  return name.trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .toUpperCase();
}

// ── Demo SKUs to remove ───────────────────────────────────────────────────────

const DEMO_SKUS = [
  'MSA54-TPU-01', 'BTC-2M-BLK', 'BT255-PLUS', 'SYS-65W-GAN',
  'ANK-20K-BLK', 'TG-RN13-CLR', 'BA-141-BLK', 'AMB-10K-WHT',
  'SYS-33W-WC',  'IP15-TRN-01',
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Starting seed...');

  // RBAC roles + default permission matrix (idempotent — safe to re-run)
  let superAdminRoleId = '';
  for (const def of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: def.name },
      update: { description: def.description, rank: def.rank, isSystem: true },
      create: { name: def.name, description: def.description, rank: def.rank, isSystem: true },
    });
    if (def.name === SUPER_ADMIN_ROLE) superAdminRoleId = role.id;
    // Reset the role's permission set to match the default matrix
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: def.permissions.map((permission) => ({ roleId: role.id, permission })),
      skipDuplicates: true,
    });
  }
  console.log(`✓ ${DEFAULT_ROLES.length} roles + permissions`);

  // Admin user — assigned to SUPER_ADMIN
  await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: { roleId: superAdminRoleId, active: true },
    create: {
      username: 'admin',
      passwordHash: await bcrypt.hash('mxd@admin2026', 10),
      roleId: superAdminRoleId,
    },
  });
  console.log('✓ Admin user (SUPER_ADMIN)');

  // Geo restrictions
  for (const state of ['Karnataka', 'Tamil Nadu', 'Andhra Pradesh']) {
    await prisma.geoRestriction.upsert({
      where: { state_district: { state, district: '' } },
      update: { allowed: true },
      create: { state, district: '', allowed: true },
    });
  }
  console.log('✓ Geo restrictions');

  // Remove demo products
  for (const sku of DEMO_SKUS) {
    try {
      await prisma.product.delete({ where: { sku } });
    } catch { /* already gone */ }
  }
  console.log('✓ Demo products removed');

  // Read CSV
  const csvPath = path.join(__dirname, '../../../../../EXTRA/mxd_products.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('⚠ CSV not found at', csvPath, '— skipping products');
    console.log('Seed complete (no products).');
    return;
  }

  const rows = parseCSV(fs.readFileSync(csvPath, 'utf-8'));
  console.log(`Found ${rows.length} products in CSV`);

  // Create categories
  const catIdByName: Record<string, string> = {};
  for (const row of rows) {
    const catKey = row['category'];
    if (!catKey || catIdByName[catKey]) continue;
    const def = CATEGORY_MAP[catKey];
    const slug = def
      ? def.slug
      : catKey.toLowerCase().replace(/\s+&\s+/g, '-and-').replace(/\s+/g, '-');
    const rec = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: def ?? { name: catKey, slug, displayOrder: 99 },
    });
    catIdByName[catKey] = rec.id;
  }
  console.log(`✓ ${Object.keys(catIdByName).length} categories`);

  // Upsert products
  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    const name = (row['name'] || '').trim();
    if (!name) continue;
    const sku = toSku(name);
    const images = (row['image_urls'] || '').split('|').filter(Boolean);
    const catId = catIdByName[row['category']];
    const description = (row['description'] || '').trim();

    try {
      await prisma.product.upsert({
        where: { sku },
        update: { images, description, categoryId: catId },
        create: {
          name,
          brand: 'MXD',
          sku,
          description,
          moq: 10,
          stockStatus: 'IN_STOCK',
          stockQty: 100,
          images,
          categoryId: catId,
        },
      });
      imported++;
    } catch (e: any) {
      console.warn(`  ⚠ Skipped ${name}: ${e.message}`);
      skipped++;
    }
  }

  console.log(`✓ Products: ${imported} upserted, ${skipped} skipped`);
  console.log('Seed complete!');
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
