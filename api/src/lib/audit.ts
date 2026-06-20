/**
 * Audit-trail writer for RBAC and account changes.
 *
 * writeAuditLog records who did what to which target. Best-effort by default
 * (a logging failure never breaks the operation); pass a transaction client to
 * make the audit write atomic with the change it records. actorName/targetName
 * are denormalized so the trail stays readable after the actor or target is
 * deleted. Read back via GET /api/admin/audit-logs.
 */
import { AuditAction, Prisma } from '@prisma/client';
import prisma from './prisma';

// Immutable audit trail for every role / permission / user change (Security req #6).
// Best-effort by default; pass a transaction client (`client`) to make the audit
// write atomic with the change it records — inside a transaction a failure rolls the
// whole operation back. actorName/targetName are denormalized so the trail survives
// later deletion of the actor or target.

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function writeAuditLog(
  params: {
    actorId: string | null;
    actorName: string;
    action: AuditAction;
    targetType: string;
    targetId?: string | null;
    targetName?: string;
    details?: Prisma.InputJsonValue;
  },
  client: DbClient = prisma
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        actorId: params.actorId,
        actorName: params.actorName,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        targetName: params.targetName ?? '',
        details: params.details ?? {},
      },
    });
  } catch (e) {
    process.stderr.write(`[AUDIT] Failed to write audit log: ${(e as Error).message}\n`);
  }
}
