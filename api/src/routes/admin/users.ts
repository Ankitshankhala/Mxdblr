/**
 * Staff/admin account management. Mounted at /api/admin/users.
 *
 * CRUD over admin users and their role assignment. Every endpoint needs at least
 * MANAGE_STAFF; acting on an admin-tier target (rank ≤ ADMIN_TIER_RANK)
 * additionally requires MANAGE_ADMINS, enforced per-handler. Anti-escalation: a
 * caller cannot create/modify users at or above their own privilege rank.
 * Passwords are bcrypt-hashed; every change is recorded via writeAuditLog.
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { requireAnyPermission, isAdminTierRank, AdminContext } from '../../middleware/rbac';
import { SUPER_ADMIN_ROLE } from '../../lib/rbac';
import { writeAuditLog } from '../../lib/audit';

const router = Router();

// Every endpoint here needs at least staff-management rights; admin-tier targets are
// additionally gated on MANAGE_ADMINS inside each handler.
router.use(requireAnyPermission('MANAGE_STAFF', 'MANAGE_ADMINS'));

/**
 * Shared authorization for acting on a target role: the caller must be allowed to
 * touch that privilege level. Returns an error message, or null if permitted.
 *  - cannot assign/manage a role at or above the caller's own rank (no escalation)
 *  - admin-tier roles require MANAGE_ADMINS; lower roles require MANAGE_STAFF
 */
function checkRoleAuthority(ctx: AdminContext, targetRank: number): string | null {
  if (targetRank <= ctx.roleRank) {
    return 'You cannot manage a user at or above your own privilege level';
  }
  if (isAdminTierRank(targetRank) && !ctx.permissions.has('MANAGE_ADMINS')) {
    return 'Managing admin-level accounts requires the Manage Admins permission';
  }
  if (!isAdminTierRank(targetRank) && !ctx.permissions.has('MANAGE_STAFF')) {
    return 'Managing staff requires the Manage Staff permission';
  }
  return null;
}

/** Block removing the last remaining active SUPER_ADMIN (deactivate/delete/role-change). */
async function isLastActiveSuperAdmin(userId: string): Promise<boolean> {
  const count = await prisma.adminUser.count({
    where: { active: true, role: { name: SUPER_ADMIN_ROLE }, id: { not: userId } },
  });
  const target = await prisma.adminUser.findUnique({ where: { id: userId }, include: { role: true } });
  return target?.active === true && target.role?.name === SUPER_ADMIN_ROLE && count === 0;
}

// ── GET /api/admin/users — list admin/staff accounts ───────────────────────────
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: 'asc' },
    include: { role: { select: { id: true, name: true, rank: true } } },
  });
  res.json({
    success: true,
    data: users.map((u) => ({
      id: u.id,
      username: u.username,
      active: u.active,
      role: u.role,
      createdAt: u.createdAt,
    })),
  });
});

// ── POST /api/admin/users — create a staff/admin account ───────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const ctx = req.adminCtx!;
  const { username, password, roleId } = req.body as { username?: unknown; password?: unknown; roleId?: unknown };

  if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 50) {
    res.status(400).json({ success: false, message: 'Username must be 3–50 characters' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    return;
  }
  if (typeof roleId !== 'string') {
    res.status(400).json({ success: false, message: 'roleId is required' });
    return;
  }

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    res.status(400).json({ success: false, message: 'Role not found' });
    return;
  }
  const authErr = checkRoleAuthority(ctx, role.rank);
  if (authErr) {
    res.status(403).json({ success: false, message: authErr });
    return;
  }

  const cleanUsername = username.trim();
  const existing = await prisma.adminUser.findUnique({ where: { username: cleanUsername } });
  if (existing) {
    res.status(409).json({ success: false, message: 'A user with that username already exists' });
    return;
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.adminUser.create({
        data: { username: cleanUsername, passwordHash: await bcrypt.hash(password, 10), roleId },
      });
      await writeAuditLog(
        {
          actorId: ctx.id, actorName: ctx.username, action: 'USER_CREATED',
          targetType: 'AdminUser', targetId: created.id, targetName: created.username,
          details: { roleId, roleName: role.name } as Prisma.InputJsonValue,
        },
        tx
      );
      return created;
    });
    res.status(201).json({
      success: true,
      data: { id: user.id, username: user.username, active: user.active, role: { id: role.id, name: role.name, rank: role.rank } },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
});

// ── PATCH /api/admin/users/:id — change role and/or active status ──────────────
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const ctx = req.adminCtx!;
  const userId = String(req.params.id);

  if (userId === ctx.id) {
    res.status(400).json({ success: false, message: 'You cannot modify your own role or status' });
    return;
  }

  const target = await prisma.adminUser.findUnique({ where: { id: userId }, include: { role: true } });
  if (!target) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }
  // Must be allowed to act on the target's CURRENT privilege level.
  const currentRank = target.role?.rank ?? 9999;
  const targetAuthErr = checkRoleAuthority(ctx, currentRank);
  if (targetAuthErr) {
    res.status(403).json({ success: false, message: targetAuthErr });
    return;
  }

  const data: Prisma.AdminUserUpdateInput = {};
  const auditDetails: Record<string, unknown> = {};
  let action: 'USER_ROLE_CHANGED' | 'USER_ACTIVATED' | 'USER_DEACTIVATED' = 'USER_ROLE_CHANGED';

  // Role change
  if (typeof req.body?.roleId === 'string' && req.body.roleId !== target.roleId) {
    const newRole = await prisma.role.findUnique({ where: { id: req.body.roleId } });
    if (!newRole) {
      res.status(400).json({ success: false, message: 'Role not found' });
      return;
    }
    const newRoleErr = checkRoleAuthority(ctx, newRole.rank);
    if (newRoleErr) {
      res.status(403).json({ success: false, message: newRoleErr });
      return;
    }
    data.role = { connect: { id: newRole.id } };
    auditDetails.roleId = newRole.id;
    auditDetails.roleName = newRole.name;
    action = 'USER_ROLE_CHANGED';
  }

  // Active status change
  if (typeof req.body?.active === 'boolean' && req.body.active !== target.active) {
    if (req.body.active === false && (await isLastActiveSuperAdmin(userId))) {
      res.status(400).json({ success: false, message: 'Cannot deactivate the last active Super Admin' });
      return;
    }
    data.active = req.body.active;
    auditDetails.active = req.body.active;
    action = req.body.active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED';
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ success: false, message: 'Nothing to update' });
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id: userId }, data });
      await writeAuditLog(
        {
          actorId: ctx.id, actorName: ctx.username, action,
          targetType: 'AdminUser', targetId: userId, targetName: target.username,
          details: auditDetails as Prisma.InputJsonValue,
        },
        tx
      );
    });
    const updated = await prisma.adminUser.findUnique({
      where: { id: userId },
      include: { role: { select: { id: true, name: true, rank: true } } },
    });
    res.json({ success: true, data: { id: updated!.id, username: updated!.username, active: updated!.active, role: updated!.role } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// ── DELETE /api/admin/users/:id — remove an account ────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const ctx = req.adminCtx!;
  const userId = String(req.params.id);

  if (userId === ctx.id) {
    res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    return;
  }

  const target = await prisma.adminUser.findUnique({ where: { id: userId }, include: { role: true } });
  if (!target) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }
  const authErr = checkRoleAuthority(ctx, target.role?.rank ?? 9999);
  if (authErr) {
    res.status(403).json({ success: false, message: authErr });
    return;
  }
  if (await isLastActiveSuperAdmin(userId)) {
    res.status(400).json({ success: false, message: 'Cannot delete the last active Super Admin' });
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // ModerationLog rows reference this admin (required FK) — detach by deleting them
      // is wrong (audit), so we only delete users with none; otherwise block.
      await tx.adminUser.delete({ where: { id: userId } });
      await writeAuditLog(
        { actorId: ctx.id, actorName: ctx.username, action: 'USER_DELETED', targetType: 'AdminUser', targetId: userId, targetName: target.username },
        tx
      );
    });
    res.json({ success: true, data: { id: userId } });
  } catch (e) {
    // Foreign-key violation (e.g. existing ModerationLog rows) → 409 instead of 500.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      res.status(409).json({ success: false, message: 'This user has linked records and cannot be deleted; deactivate them instead.' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

export default router;
