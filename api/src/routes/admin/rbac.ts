import { Router, Request, Response } from 'express';
import { Permission, Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { requireAnyPermission, requirePermission, AdminContext } from '../../middleware/rbac';
import { PERMISSION_CATALOG, ALL_PERMISSIONS } from '../../lib/rbac';
import { writeAuditLog } from '../../lib/audit';

const router = Router();

// ── helpers ───────────────────────────────────────────────────────────────────
const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);

/** Validate a permissions array against the catalog. Returns null if anything is invalid. */
function parsePermissions(input: unknown): Permission[] | null {
  if (!Array.isArray(input)) return null;
  const out = new Set<Permission>();
  for (const x of input) {
    if (typeof x !== 'string' || !PERMISSION_SET.has(x)) return null;
    out.add(x as Permission);
  }
  return Array.from(out);
}

/** A caller may only grant permissions they themselves hold (no privilege escalation). */
function withinCallerPermissions(ctx: AdminContext, perms: Permission[]): boolean {
  return perms.every((p) => ctx.permissions.has(p));
}

// ── GET /api/admin/me — current user's identity, role, and permissions ─────────
// Any authenticated, active admin. Drives frontend menu/route gating.
router.get('/me', requireAnyPermission(), (req: Request, res: Response) => {
  const ctx = req.adminCtx!;
  res.json({
    success: true,
    data: {
      id: ctx.id,
      username: ctx.username,
      role: ctx.roleId ? { id: ctx.roleId, name: ctx.roleName, rank: ctx.roleRank } : null,
      permissions: Array.from(ctx.permissions),
    },
  });
});

// ── GET /api/admin/permissions — the fixed permission catalog ──────────────────
router.get('/permissions', requirePermission('MANAGE_ROLES'), (_req: Request, res: Response) => {
  res.json({ success: true, data: PERMISSION_CATALOG });
});

// ── GET /api/admin/roles — list roles (for role editor + user-role dropdowns) ──
router.get(
  '/roles',
  requireAnyPermission('MANAGE_ROLES', 'MANAGE_STAFF', 'MANAGE_ADMINS'),
  async (_req: Request, res: Response): Promise<void> => {
    const roles = await prisma.role.findMany({
      orderBy: { rank: 'asc' },
      include: { permissions: true, _count: { select: { users: true } } },
    });
    res.json({
      success: true,
      data: roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        rank: r.rank,
        userCount: r._count.users,
        permissions: r.permissions.map((p) => p.permission),
      })),
    });
  }
);

// ── POST /api/admin/roles — create a custom role ───────────────────────────────
router.post('/roles', requirePermission('MANAGE_ROLES'), async (req: Request, res: Response): Promise<void> => {
  const ctx = req.adminCtx!;
  const { name, description } = req.body as { name?: unknown; description?: unknown };
  const permissions = parsePermissions(req.body?.permissions);

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
    res.status(400).json({ success: false, message: 'Role name must be 2–50 characters' });
    return;
  }
  if (permissions === null) {
    res.status(400).json({ success: false, message: 'permissions must be an array of valid permission keys' });
    return;
  }
  if (!withinCallerPermissions(ctx, permissions)) {
    res.status(403).json({ success: false, message: 'You cannot grant a permission you do not hold' });
    return;
  }

  // New role must be strictly less privileged than the creator.
  const requestedRank = typeof req.body?.rank === 'number' ? req.body.rank : Math.max(ctx.roleRank + 10, 100);
  if (requestedRank <= ctx.roleRank) {
    res.status(403).json({ success: false, message: 'You cannot create a role at or above your own privilege level' });
    return;
  }

  const cleanName = name.trim();
  const existing = await prisma.role.findUnique({ where: { name: cleanName } });
  if (existing) {
    res.status(409).json({ success: false, message: 'A role with that name already exists' });
    return;
  }

  try {
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          name: cleanName,
          description: typeof description === 'string' ? description : '',
          rank: requestedRank,
          isSystem: false,
          permissions: { create: permissions.map((permission) => ({ permission })) },
        },
        include: { permissions: true },
      });
      await writeAuditLog(
        {
          actorId: ctx.id,
          actorName: ctx.username,
          action: 'ROLE_CREATED',
          targetType: 'Role',
          targetId: created.id,
          targetName: created.name,
          details: { permissions, rank: requestedRank } as Prisma.InputJsonValue,
        },
        tx
      );
      return created;
    });
    res.status(201).json({
      success: true,
      data: { id: role.id, name: role.name, description: role.description, rank: role.rank, isSystem: role.isSystem, permissions: role.permissions.map((p) => p.permission) },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create role' });
  }
});

// ── PATCH /api/admin/roles/:id — edit description / permissions ────────────────
router.patch('/roles/:id', requirePermission('MANAGE_ROLES'), async (req: Request, res: Response): Promise<void> => {
  const ctx = req.adminCtx!;
  const roleId = String(req.params.id);
  const role = await prisma.role.findUnique({ where: { id: roleId }, include: { permissions: true } });
  if (!role) {
    res.status(404).json({ success: false, message: 'Role not found' });
    return;
  }
  // Anti-lockout / anti-escalation: you can only edit roles strictly below your own
  // privilege. This also makes the SUPER_ADMIN role (rank 0) uneditable by anyone.
  if (role.rank <= ctx.roleRank) {
    res.status(403).json({ success: false, message: 'You cannot modify a role at or above your own privilege level' });
    return;
  }

  const data: Prisma.RoleUpdateInput = {};
  const auditDetails: Record<string, unknown> = {};
  let resolvedName = role.name;

  if (typeof req.body?.description === 'string') {
    data.description = req.body.description;
    auditDetails.description = req.body.description;
  }
  // System roles keep their name/rank stable; only custom roles may be renamed/re-ranked.
  if (typeof req.body?.name === 'string') {
    if (role.isSystem) {
      res.status(400).json({ success: false, message: 'System roles cannot be renamed' });
      return;
    }
    const cleanName = req.body.name.trim();
    if (cleanName.length < 2 || cleanName.length > 50) {
      res.status(400).json({ success: false, message: 'Role name must be 2–50 characters' });
      return;
    }
    const clash = await prisma.role.findUnique({ where: { name: cleanName } });
    if (clash && clash.id !== role.id) {
      res.status(409).json({ success: false, message: 'A role with that name already exists' });
      return;
    }
    data.name = cleanName;
    resolvedName = cleanName;
    auditDetails.name = cleanName;
  }

  let newPermissions: Permission[] | null = null;
  if (req.body?.permissions !== undefined) {
    newPermissions = parsePermissions(req.body.permissions);
    if (newPermissions === null) {
      res.status(400).json({ success: false, message: 'permissions must be an array of valid permission keys' });
      return;
    }
    if (!withinCallerPermissions(ctx, newPermissions)) {
      res.status(403).json({ success: false, message: 'You cannot grant a permission you do not hold' });
      return;
    }
    auditDetails.permissions = newPermissions;
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.role.update({ where: { id: role.id }, data });
      }
      if (newPermissions !== null) {
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        if (newPermissions.length > 0) {
          await tx.rolePermission.createMany({
            data: newPermissions.map((permission) => ({ roleId: role.id, permission })),
          });
        }
      }
      await writeAuditLog(
        {
          actorId: ctx.id,
          actorName: ctx.username,
          action: newPermissions !== null ? 'ROLE_PERMISSIONS_UPDATED' : 'ROLE_UPDATED',
          targetType: 'Role',
          targetId: role.id,
          targetName: resolvedName,
          details: auditDetails as Prisma.InputJsonValue,
        },
        tx
      );
    });
    const updated = await prisma.role.findUnique({ where: { id: role.id }, include: { permissions: true } });
    res.json({
      success: true,
      data: { id: updated!.id, name: updated!.name, description: updated!.description, rank: updated!.rank, isSystem: updated!.isSystem, permissions: updated!.permissions.map((p) => p.permission) },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update role' });
  }
});

// ── DELETE /api/admin/roles/:id — delete a custom role ─────────────────────────
router.delete('/roles/:id', requirePermission('MANAGE_ROLES'), async (req: Request, res: Response): Promise<void> => {
  const ctx = req.adminCtx!;
  const roleId = String(req.params.id);
  const role = await prisma.role.findUnique({ where: { id: roleId }, include: { _count: { select: { users: true } } } });
  if (!role) {
    res.status(404).json({ success: false, message: 'Role not found' });
    return;
  }
  if (role.isSystem) {
    res.status(400).json({ success: false, message: 'System roles cannot be deleted' });
    return;
  }
  if (role.rank <= ctx.roleRank) {
    res.status(403).json({ success: false, message: 'You cannot delete a role at or above your own privilege level' });
    return;
  }
  if (role._count.users > 0) {
    res.status(409).json({ success: false, message: `Reassign the ${role._count.users} user(s) on this role before deleting it` });
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.role.delete({ where: { id: role.id } });
      await writeAuditLog(
        { actorId: ctx.id, actorName: ctx.username, action: 'ROLE_DELETED', targetType: 'Role', targetId: role.id, targetName: role.name },
        tx
      );
    });
    res.json({ success: true, data: { id: role.id } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete role' });
  }
});

// ── GET /api/admin/audit-logs — recent role/permission/user changes ────────────
router.get(
  '/audit-logs',
  requireAnyPermission('MANAGE_ROLES', 'MANAGE_ADMINS'),
  async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    res.json({ success: true, data: logs });
  }
);

export default router;
