import "server-only";
import { prisma } from "@/server/db";
import { archive, restore, type ArchivableModel } from "@/server/db/soft-delete";
import { audit } from "@/server/modules/audit/service";
import type { AdminActor } from "./guard";

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** Archive (soft delete) rows of one table, with an audit entry. */
export async function archiveRecords(actor: AdminActor, model: ArchivableModel, ids: string[], noun: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const n = await archive(tx, model, ids);
    if (n) await audit(tx, { actorId: actor.id, action: "record.archived", entity: model, entityId: ids.length === 1 ? ids[0] : null, after: { ids }, summary: `Archived ${plural(n, noun)}`, ip: actor.ip });
    return n;
  });
}

/** Undo of archive, and the Restore button on the Archived tab. */
export async function restoreRecords(actor: AdminActor, model: ArchivableModel, ids: string[], noun: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const n = await restore(tx, model, ids);
    if (n) await audit(tx, { actorId: actor.id, action: "record.restored", entity: model, entityId: ids.length === 1 ? ids[0] : null, after: { ids }, summary: `Restored ${plural(n, noun)}`, ip: actor.ip });
    return n;
  });
}
