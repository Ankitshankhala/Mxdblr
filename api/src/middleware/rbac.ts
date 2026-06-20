import { Request, Response, NextFunction } from 'express';
import { Permission } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticateAdminToken } from './auth';

// Resolved authorization context for the current request, looked up fresh from the
// DB on every admin request (no permissions are trusted from the JWT).
export interface AdminContext {
  id: string;
  username: string;
  roleId: string | null;
  roleName: string | null;
  roleRank: number;        // lower = more privileged; SUPER_ADMIN = 0
  permissions: Set<Permission>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminCtx?: AdminContext;
    }
  }
}

const NO_ROLE_RANK = 9999;

// Roles at or below this rank are "admin-tier": creating/managing users on them
// requires MANAGE_ADMINS, not just MANAGE_STAFF. (SUPER_ADMIN=0, ADMIN=10.)
export const ADMIN_TIER_RANK = 10;
export function isAdminTierRank(rank: number): boolean {
  return rank <= ADMIN_TIER_RANK;
}

export async function loadAdminContext(adminId: string): Promise<AdminContext | null> {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    include: { role: { include: { permissions: true } } },
  });
  if (!admin || !admin.active) return null;
  return {
    id: admin.id,
    username: admin.username,
    roleId: admin.roleId,
    roleName: admin.role?.name ?? null,
    roleRank: admin.role?.rank ?? NO_ROLE_RANK,
    permissions: new Set((admin.role?.permissions ?? []).map((p) => p.permission)),
  };
}

export function hasPermission(ctx: AdminContext, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

/**
 * Guard that requires the caller to hold AT LEAST ONE of the given permissions.
 * Self-authenticating: verifies the admin token, loads the live role/permission set,
 * rejects deactivated accounts, and attaches `req.adminCtx`. Pass no permissions to
 * require only a valid, active admin (used by `GET /api/admin/me`).
 */
export function requireAnyPermission(...required: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const payload = authenticateAdminToken(req);
    if (!payload) {
      res.status(401).json({ success: false, message: 'Admin authentication required' });
      return;
    }
    try {
      const ctx = await loadAdminContext(payload.adminId);
      if (!ctx) {
        res.status(401).json({ success: false, message: 'Account not found or deactivated' });
        return;
      }
      req.admin = payload;
      req.adminCtx = ctx;

      if (required.length === 0 || required.some((p) => ctx.permissions.has(p))) {
        next();
        return;
      }
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
        requiredPermission: required,
      });
    } catch {
      res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
}

/** Guard that requires the caller to hold a single specific permission. */
export function requirePermission(permission: Permission) {
  return requireAnyPermission(permission);
}

/**
 * Lightweight per-route guard for use AFTER a `requireAnyPermission`/`requirePermission`
 * guard has already run on the same chain (so `req.adminCtx` is loaded). Used to layer a
 * stricter permission on a specific endpoint without a second DB lookup — e.g. a router
 * mounted with MANAGE_PRODUCTS|MANAGE_INVENTORY, where mutations additionally need
 * MANAGE_PRODUCTS. Requires at least one of `required`.
 */
export function requireLoadedPermission(...required: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ctx = req.adminCtx;
    if (!ctx) {
      res.status(401).json({ success: false, message: 'Admin authentication required' });
      return;
    }
    if (required.some((p) => ctx.permissions.has(p))) {
      next();
      return;
    }
    res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action',
      requiredPermission: required,
    });
  };
}
