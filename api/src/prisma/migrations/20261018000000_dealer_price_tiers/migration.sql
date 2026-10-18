-- Dealer price lists.
--
-- Every product gets three per-piece prices (A, B, C). Each dealer is assigned
-- one list and an on/off switch by an admin; prices stay hidden from every
-- dealer until an admin switches them on (showPrices defaults to false).
--
-- Additive only: new nullable/defaulted columns, a new enum, and a new audit
-- action. ALTER TYPE ... ADD VALUE is only referenced at runtime, never in this
-- migration, so it is safe inside the migration transaction.

-- CreateEnum
CREATE TYPE "PriceTier" AS ENUM ('A', 'B', 'C');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DEALER_PRICING_CHANGED';

-- AlterTable
ALTER TABLE "Dealer" ADD COLUMN     "priceTier" "PriceTier" NOT NULL DEFAULT 'A',
ADD COLUMN     "showPrices" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "priceA" DOUBLE PRECISION,
ADD COLUMN     "priceB" DOUBLE PRECISION,
ADD COLUMN     "priceC" DOUBLE PRECISION;
