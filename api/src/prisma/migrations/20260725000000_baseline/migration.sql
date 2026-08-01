-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DealerStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BLOCKED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('RETAIL_SHOP', 'WHOLESALER', 'DISTRIBUTOR', 'REPAIR_SHOP', 'ONLINE_SELLER', 'MOBILE_ACCESSORIES_STORE');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'VIEWED', 'RESPONDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProductFeatureCategory" AS ENUM ('CHARGING', 'WIRELESS', 'CABLE', 'DATA', 'PROTECTION', 'CERTIFICATION');

-- CreateEnum
CREATE TYPE "FeatureDisplayMode" AS ENUM ('ICON', 'IMAGE', 'BOTH');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('VIEW_DASHBOARD', 'MANAGE_PRODUCTS', 'MANAGE_INVENTORY', 'CREATE_ORDERS', 'EDIT_ORDERS', 'VIEW_REPORTS', 'MANAGE_STAFF', 'MANAGE_CUSTOMERS', 'ACCESS_FINANCIAL_DATA', 'SYSTEM_SETTINGS', 'MANAGE_ROLES', 'MANAGE_ADMINS');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_PERMISSIONS_UPDATED', 'ROLE_DELETED', 'USER_CREATED', 'USER_ROLE_CHANGED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'USER_DELETED');

-- CreateEnum
CREATE TYPE "BannerType" AS ENUM ('SIMPLE', 'PRODUCT_PROMO', 'BRAND_PROMO');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('PRODUCT_LAUNCH', 'DEALER_MEETUP', 'TRAINING', 'EXHIBITION', 'CELEBRATION', 'OTHER');

-- CreateTable
CREATE TABLE "Dealer" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "altMobile" TEXT,
    "city" TEXT NOT NULL,
    "tehsil" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "pincode" TEXT NOT NULL,
    "gstNumber" TEXT,
    "businessType" "BusinessType" NOT NULL,
    "status" "DealerStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastRevokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dealer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "categoryId" TEXT,

    CONSTRAINT "AttributeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "moq" INTEGER NOT NULL DEFAULT 1,
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'IN_STOCK',
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price" DOUBLE PRECISION,
    "pricingActive" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isNewArrival" BOOLEAN NOT NULL DEFAULT false,
    "isBestSeller" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttribute" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeTypeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFeature" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "displayMode" "FeatureDisplayMode" NOT NULL DEFAULT 'ICON',
    "category" "ProductFeatureCategory" NOT NULL DEFAULT 'CHARGING',
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFeatureLink" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductFeatureLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompatibilityTag" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "CompatibilityTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryLog" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "cartSnapshot" JSONB NOT NULL DEFAULT '[]',
    "whatsappSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSubscription" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT,
    "productId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoRestriction" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL DEFAULT '',
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "roleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetName" TEXT NOT NULL DEFAULT '',
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "whatsappNumber" TEXT NOT NULL DEFAULT '',
    "msg91ApiKey" TEXT NOT NULL DEFAULT '',
    "cloudinaryCloud" TEXT NOT NULL DEFAULT '',
    "cloudinaryApiKey" TEXT NOT NULL DEFAULT '',
    "cloudinaryApiSecret" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "bannerType" "BannerType" NOT NULL DEFAULT 'SIMPLE',
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "ctaText" TEXT NOT NULL DEFAULT 'Browse Catalog',
    "ctaLink" TEXT NOT NULL DEFAULT '/catalog',
    "image" TEXT NOT NULL DEFAULT '',
    "mobileImage" TEXT NOT NULL DEFAULT '',
    "bgColor" TEXT NOT NULL DEFAULT '#1A1A2E',
    "accentColor" TEXT NOT NULL DEFAULT '#F47920',
    "logoImage" TEXT NOT NULL DEFAULT '',
    "productImage1" TEXT NOT NULL DEFAULT '',
    "productImage2" TEXT NOT NULL DEFAULT '',
    "productImage3" TEXT NOT NULL DEFAULT '',
    "overlayOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "textAlignment" TEXT NOT NULL DEFAULT 'left',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" "EventCategory" NOT NULL DEFAULT 'OTHER',
    "eventDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT NOT NULL DEFAULT '',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videos" JSONB NOT NULL DEFAULT '[]',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dealer_mobile_key" ON "Dealer"("mobile");

-- CreateIndex
CREATE INDEX "OtpCode_mobile_idx" ON "OtpCode"("mobile");

-- CreateIndex
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product"("brand");

-- CreateIndex
CREATE INDEX "Product_stockStatus_idx" ON "Product"("stockStatus");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "Product"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFeature_slug_key" ON "ProductFeature"("slug");

-- CreateIndex
CREATE INDEX "ProductFeature_category_idx" ON "ProductFeature"("category");

-- CreateIndex
CREATE INDEX "ProductFeature_active_idx" ON "ProductFeature"("active");

-- CreateIndex
CREATE INDEX "ProductFeatureLink_productId_idx" ON "ProductFeatureLink"("productId");

-- CreateIndex
CREATE INDEX "ProductFeatureLink_featureId_idx" ON "ProductFeatureLink"("featureId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFeatureLink_productId_featureId_key" ON "ProductFeatureLink"("productId", "featureId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_dealerId_productId_key" ON "CartItem"("dealerId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSubscription_phoneNumber_productId_key" ON "NotificationSubscription"("phoneNumber", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "GeoRestriction_state_district_key" ON "GeoRestriction"("state", "district");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "AdminUser_roleId_idx" ON "AdminUser"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permission_key" ON "RolePermission"("roleId", "permission");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "Event_published_displayOrder_eventDate_idx" ON "Event"("published", "displayOrder", "eventDate");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeType" ADD CONSTRAINT "AttributeType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_attributeTypeId_fkey" FOREIGN KEY ("attributeTypeId") REFERENCES "AttributeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFeatureLink" ADD CONSTRAINT "ProductFeatureLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFeatureLink" ADD CONSTRAINT "ProductFeatureLink_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "ProductFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityTag" ADD CONSTRAINT "CompatibilityTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryLog" ADD CONSTRAINT "InquiryLog_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data carried over from the pre-squash migration history
-- (20260602000000_add_system_settings, 20260619120000_add_rbac)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "SystemSettings" ("id", "updatedAt") VALUES (1, NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Role" ("id", "name", "description", "isSystem", "rank", "updatedAt") VALUES
  ('role_super_admin', 'SUPER_ADMIN', 'Full control over the platform, roles, permissions, and admin accounts.', true, 0, CURRENT_TIMESTAMP),
  ('role_admin',       'ADMIN',       'Platform administration. Can assign staff to roles but cannot change role definitions, manage admin accounts, or change system settings.', true, 10, CURRENT_TIMESTAMP),
  ('role_manager',     'MANAGER',     'Operational management of catalog, inventory, orders, and customers.', true, 20, CURRENT_TIMESTAMP),
  ('role_shop_worker', 'SHOP_WORKER', 'Basic day-to-day functions: dashboard, inventory updates, and creating orders.', true, 30, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- ── Seed the default permission matrix ────────────────────────────────────────
INSERT INTO "RolePermission" ("id", "roleId", "permission")
SELECT 'rp_super_' || p, 'role_super_admin', p::"Permission" FROM unnest(ARRAY[
  'VIEW_DASHBOARD','MANAGE_PRODUCTS','MANAGE_INVENTORY','CREATE_ORDERS','EDIT_ORDERS',
  'VIEW_REPORTS','MANAGE_STAFF','MANAGE_CUSTOMERS','ACCESS_FINANCIAL_DATA','SYSTEM_SETTINGS',
  'MANAGE_ROLES','MANAGE_ADMINS']) AS p
ON CONFLICT ("roleId", "permission") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permission")
SELECT 'rp_admin_' || p, 'role_admin', p::"Permission" FROM unnest(ARRAY[
  'VIEW_DASHBOARD','MANAGE_PRODUCTS','MANAGE_INVENTORY','CREATE_ORDERS','EDIT_ORDERS',
  'VIEW_REPORTS','MANAGE_STAFF','MANAGE_CUSTOMERS']) AS p
ON CONFLICT ("roleId", "permission") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permission")
SELECT 'rp_manager_' || p, 'role_manager', p::"Permission" FROM unnest(ARRAY[
  'VIEW_DASHBOARD','MANAGE_PRODUCTS','MANAGE_INVENTORY','CREATE_ORDERS','EDIT_ORDERS',
  'VIEW_REPORTS','MANAGE_CUSTOMERS']) AS p
ON CONFLICT ("roleId", "permission") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permission")
SELECT 'rp_worker_' || p, 'role_shop_worker', p::"Permission" FROM unnest(ARRAY[
  'VIEW_DASHBOARD','MANAGE_INVENTORY','CREATE_ORDERS']) AS p
ON CONFLICT ("roleId", "permission") DO NOTHING;
