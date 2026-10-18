-- Compatible handset brands for products.
--
-- The product form's "Compatible Brand" box wrote to Product.brand, which is the
-- MANUFACTURER field ("MXD" on every product), so filtering by a Brands-list
-- entry ("For Apple") never matched. Compatibility now gets its own relation to
-- the Brands list, plus fitsAllBrands for universal accessories. Product.brand
-- is untouched.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "fitsAllBrands" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable (A = Brand.id, B = Product.id; Prisma implicit many-to-many)
CREATE TABLE "_ProductCompatibleBrands" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProductCompatibleBrands_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ProductCompatibleBrands_B_index" ON "_ProductCompatibleBrands"("B");

-- AddForeignKey
ALTER TABLE "_ProductCompatibleBrands" ADD CONSTRAINT "_ProductCompatibleBrands_A_fkey" FOREIGN KEY ("A") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductCompatibleBrands" ADD CONSTRAINT "_ProductCompatibleBrands_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
