-- AlterTable
-- Adds an optional device-specific mobile hero image. Empty string means
-- "no mobile-specific image" — the app falls back to the existing `image`.
ALTER TABLE "Banner" ADD COLUMN "mobileImage" TEXT NOT NULL DEFAULT '';
