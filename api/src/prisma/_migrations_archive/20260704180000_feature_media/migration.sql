-- Product Feature media: add a larger `image` alongside the existing `logo`
-- (icon), and a `displayMode` so a feature can render icon-only, image-only, or
-- both. Existing rows keep logo + default to ICON — no behaviour change for them.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FeatureDisplayMode" AS ENUM ('ICON', 'IMAGE', 'BOTH');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "ProductFeature"
  ADD COLUMN IF NOT EXISTS "image" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "displayMode" "FeatureDisplayMode" NOT NULL DEFAULT 'ICON';
