-- Stock status follows stock quantity.
--
-- Products were saved as IN_STOCK with stockQty 0 (all 165 on 2026-10-18: no
-- quantity had ever been entered), so the dashboard's Low/Out of Stock counts
-- meant nothing. From now on a counted quantity decides the status (lib/stock.ts);
-- stockQty NULL means "not counted yet" and the status stays as set by hand.

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "stockQty" DROP NOT NULL,
ALTER COLUMN "stockQty" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 10;

-- Backfill. A 0 that contradicts its status was never a real count: mark it
-- not counted, so those products stay orderable instead of all turning
-- OUT_OF_STOCK. (OUT_OF_STOCK with 0 agrees, so it stays counted.)
UPDATE "Product"
SET "stockQty" = NULL
WHERE "stockQty" = 0 AND "stockStatus" <> 'OUT_OF_STOCK';

-- Every remaining counted product gets the status its quantity implies
-- (10 = the default lowStockThreshold above).
UPDATE "Product"
SET "stockStatus" = CASE
  WHEN "stockQty" <= 0 THEN 'OUT_OF_STOCK'::"StockStatus"
  WHEN "stockQty" <= 10 THEN 'LOW_STOCK'::"StockStatus"
  ELSE 'IN_STOCK'::"StockStatus"
END
WHERE "stockQty" IS NOT NULL;
