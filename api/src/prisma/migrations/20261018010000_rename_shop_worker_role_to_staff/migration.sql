-- Rename the SHOP_WORKER system role to STAFF.
--
-- Updates the existing row in place (its id stays role_shop_worker), so every
-- admin account on the role keeps it, along with its permissions and audit
-- history. Skipped if a role named STAFF already exists, so the migration can
-- never fail on the unique name; the Roles page would then still list
-- SHOP_WORKER for an admin to sort out by hand.

UPDATE "Role"
SET "name" = 'STAFF', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'SHOP_WORKER'
  AND NOT EXISTS (SELECT 1 FROM "Role" WHERE "name" = 'STAFF');
