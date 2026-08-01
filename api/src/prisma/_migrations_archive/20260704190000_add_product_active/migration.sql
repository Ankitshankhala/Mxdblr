-- Storefront visibility flag for products (soft-hide instead of delete).
-- Existing products default to visible so this is a no-op for current data.
ALTER TABLE "Product" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- Index the flag: every public storefront query filters on active = true.
CREATE INDEX "Product_active_idx" ON "Product" ("active");
