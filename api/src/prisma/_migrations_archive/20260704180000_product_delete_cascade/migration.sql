-- Allow deleting a Product that is still referenced by carts / notification rows.
-- Previously these FKs were ON DELETE RESTRICT, so deleting an in-use product
-- threw a FK violation (P2003) surfaced as an opaque 500. Switch to CASCADE so
-- the dependent rows are removed with the product (matches CompatibilityTag /
-- ProductFeatureLink, which already cascade).

-- CartItem.productId → CASCADE
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_productId_fkey";
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NotificationSubscription.productId → CASCADE
ALTER TABLE "NotificationSubscription" DROP CONSTRAINT "NotificationSubscription_productId_fkey";
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NotificationLog.productId → CASCADE
ALTER TABLE "NotificationLog" DROP CONSTRAINT "NotificationLog_productId_fkey";
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
