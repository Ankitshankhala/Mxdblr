-- CreateEnum
CREATE TYPE "ProductFeatureCategory" AS ENUM (
    'CHARGING',
    'WIRELESS',
    'CABLE',
    'DATA',
    'PROTECTION',
    'CERTIFICATION'
);

-- CreateTable
CREATE TABLE "ProductFeature" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "slug"         TEXT NOT NULL,
    "logo"         TEXT NOT NULL DEFAULT '',
    "category"     "ProductFeatureCategory" NOT NULL DEFAULT 'CHARGING',
    "description"  TEXT NOT NULL DEFAULT '',
    "active"       BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFeatureLink" (
    "id"           TEXT NOT NULL,
    "productId"    TEXT NOT NULL,
    "featureId"    TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductFeatureLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductFeature_slug_key" ON "ProductFeature"("slug");

-- CreateIndex
CREATE INDEX "ProductFeature_category_idx" ON "ProductFeature"("category");

-- CreateIndex
CREATE INDEX "ProductFeature_active_idx" ON "ProductFeature"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFeatureLink_productId_featureId_key" ON "ProductFeatureLink"("productId", "featureId");

-- CreateIndex
CREATE INDEX "ProductFeatureLink_productId_idx" ON "ProductFeatureLink"("productId");

-- CreateIndex
CREATE INDEX "ProductFeatureLink_featureId_idx" ON "ProductFeatureLink"("featureId");

-- AddForeignKey
ALTER TABLE "ProductFeatureLink" ADD CONSTRAINT "ProductFeatureLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFeatureLink" ADD CONSTRAINT "ProductFeatureLink_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "ProductFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
