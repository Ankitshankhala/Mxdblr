/**
 * One-off data repair (2026-08-12): correct the stored capitalisation of the
 * "Oneplus" brand to the vendor's own "OnePlus". Name only — the slug stays
 * "oneplus" because it is a URL key and changing it would break any existing
 * links. Backs up the row before writing.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const p = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: process.env.DATABASE_URL })) });

(async () => {
  const before = await p.brand.findUnique({ where: { slug: 'oneplus' } });
  if (!before) { console.log('no brand with slug "oneplus" — nothing to do'); return p.$disconnect(); }
  if (before.name === 'OnePlus') { console.log('already "OnePlus" — nothing to do'); return p.$disconnect(); }

  const backupPath = path.join(__dirname, `_backup_brandcase_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(before, null, 2));
  console.log('backup written ->', backupPath);

  const after = await p.brand.update({ where: { id: before.id }, data: { name: 'OnePlus' } });
  console.log(`renamed ${JSON.stringify(before.name)} -> ${JSON.stringify(after.name)} (slug unchanged: ${after.slug})`);
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
