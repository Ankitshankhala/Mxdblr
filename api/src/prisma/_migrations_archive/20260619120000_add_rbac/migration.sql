-- RBAC: roles, permissions, audit log, and admin-user role assignment.
-- Backfills existing AdminUser rows to SUPER_ADMIN so no one is locked out
-- (the pre-RBAC model granted every admin full access).

-- ── Enums ─────────────────────────────────────────────────────────────────────
CREATE TYPE "Permission" AS ENUM (
  'VIEW_DASHBOARD', 'MANAGE_PRODUCTS', 'MANAGE_INVENTORY', 'CREATE_ORDERS',
  'EDIT_ORDERS', 'VIEW_REPORTS', 'MANAGE_STAFF', 'MANAGE_CUSTOMERS',
  'ACCESS_FINANCIAL_DATA', 'SYSTEM_SETTINGS', 'MANAGE_ROLES', 'MANAGE_ADMINS'
);

CREATE TYPE "AuditAction" AS ENUM (
  'ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_PERMISSIONS_UPDATED', 'ROLE_DELETED',
  'USER_CREATED', 'USER_ROLE_CHANGED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'USER_DELETED'
);

-- ── Tables ────────────────────────────────────────────────────────────────────
CREATE TABLE "Role" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isSystem"    BOOLEAN NOT NULL DEFAULT false,
    "rank"        INTEGER NOT NULL DEFAULT 100,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

CREATE TABLE "RolePermission" (
    "id"         TEXT NOT NULL,
    "roleId"     TEXT NOT NULL,
    "permission" "Permission" NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RolePermission_roleId_permission_key" ON "RolePermission"("roleId", "permission");
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

CREATE TABLE "AuditLog" (
    "id"         TEXT NOT NULL,
    "actorId"    TEXT,
    "actorName"  TEXT NOT NULL,
    "action"     "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId"   TEXT,
    "targetName" TEXT NOT NULL DEFAULT '',
    "details"    JSONB NOT NULL DEFAULT '{}',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- ── AdminUser: add role assignment + active flag + updatedAt; drop legacy role ──
ALTER TABLE "AdminUser" ADD COLUMN "active"    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AdminUser" ADD COLUMN "roleId"    TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- ── Foreign keys ────────────────────────────────────────────────────────────
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AdminUser_roleId_idx" ON "AdminUser"("roleId");

-- ── Seed the four system roles ────────────────────────────────────────────────
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

-- ── Backfill existing admins, then finalize columns ───────────────────────────
UPDATE "AdminUser" SET "roleId" = CASE "role"
    WHEN 'ADMIN'       THEN 'role_admin'
    WHEN 'MANAGER'     THEN 'role_manager'
    WHEN 'SHOP_WORKER' THEN 'role_shop_worker'
    ELSE 'role_super_admin'  -- 'SUPER_ADMIN','STAFF', or anything else → SUPER_ADMIN (preserve prior full access; never lock out)
  END
  WHERE "roleId" IS NULL;

UPDATE "AdminUser" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "AdminUser" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "AdminUser" DROP COLUMN "role";
