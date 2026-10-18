-- One-time backfill: compatible brands for the existing catalogue (165 products
-- on 2026-10-18). Runs once per database, like every migration.
--
-- Nearly everything MXD sells fits any phone: Bluetooth audio, chargers, power
-- banks, stands, and cables/adapters sold in Type-C / Micro / Lightning
-- versions. Those are marked fitsAllBrands. Two products only fit some phones:
--
--   MXD-314        Lightning to 3.5mm Jack Adapter  -> For Apple
--   MXD-BN35-BN56  BN35 / BN56 battery              -> For Xiaomi, For Redmi, For Poco
--
-- Brands are matched by slug, so a database without those brands or SKUs just
-- gets fewer rows; nothing fails. Admins refine any product in the product form.

UPDATE "Product"
SET "fitsAllBrands" = true
WHERE "sku" NOT IN ('MXD-314', 'MXD-BN35-BN56');

INSERT INTO "_ProductCompatibleBrands" ("A", "B")
SELECT b."id", p."id"
FROM "Product" p
JOIN "Brand" b
  ON (p."sku" = 'MXD-314' AND b."slug" = 'apple')
  OR (p."sku" = 'MXD-BN35-BN56' AND b."slug" IN ('xiaomi', 'redmi', 'poco'))
ON CONFLICT DO NOTHING;
