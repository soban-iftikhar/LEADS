import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { hashIp } from "@/server/http/client-ip";

/**
 * Audit trail (SPEC_02 5.13) in `ops.audit_log`. Records who did what to which row. Never pass
 * passwords, codes, tokens, phone numbers or raw IPs in `before`/`after`.
 */
export type AuditAction =
  | "auth.admin_login"
  | "auth.admin_login_failed"
  | "listing.reviewed"
  | "payment.confirmed"
  | "user.suspended"
  | "user.unsuspended"
  | "admin.created"
  | "record.archived"
  | "record.restored"
  | "prospect.invited"
  | "area.created"
  | "area.updated";

export async function audit(
  db: Prisma.TransactionClient,
  entry: {
    actorId: string | null;
    action: AuditAction;
    entity: string;
    entityId?: string | null;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    /** One readable line for the activity log. */
    summary?: string;
    ip?: string;
  },
): Promise<void> {
  await db.auditLog.create({
    data: { actorUserId: entry.actorId, action: entry.action, entity: entry.entity, entityId: entry.entityId ?? null, before: entry.before, after: entry.after, summary: entry.summary ?? null, ipHash: hashIp(entry.ip) },
  });
}

export const auditStandalone = (entry: Parameters<typeof audit>[1]) => audit(prisma, entry);
