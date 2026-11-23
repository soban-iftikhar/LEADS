import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Soft delete for every admin-managed table: "archive" stamps `archived_at`, "restore" clears it,
 * and lists show only rows where it is null unless the Archived tab is open. Rows are never
 * deleted from the admin.
 */

export type ArchivableModel =
  | "masterListing"
  | "locality"
  | "listing"
  | "campaign"
  | "messageTemplate"
  | "contact"
  | "lead"
  | "leadReport"
  | "order"
  | "payment"
  | "portal"
  | "packagePlan";

/** Default filter for every admin query. */
export const notArchived = () => ({ archivedAt: null });

/** The list tab decides which side of the archive a query reads. */
export const archiveScope = (tab: string | undefined) => (tab === "archived" ? { archivedAt: { not: null } } : notArchived());

type Stampable = {
  updateMany(args: { where: { id: { in: string[] }; archivedAt: null | { not: null } }; data: { archivedAt: Date | null } }): Promise<{ count: number }>;
};

// Every archivable model has the same nullable `archivedAt` column; the cast narrows the delegate
// to the one call used here, which Prisma's per-model types can't express as a union.
const table = (tx: Prisma.TransactionClient, model: ArchivableModel) => tx[model] as unknown as Stampable;

/** Archives the given rows that aren't archived yet. Returns how many changed. */
export async function archive(tx: Prisma.TransactionClient, model: ArchivableModel, ids: string[], at: Date = new Date()): Promise<number> {
  if (!ids.length) return 0;
  const r = await table(tx, model).updateMany({ where: { id: { in: ids }, archivedAt: null }, data: { archivedAt: at } });
  return r.count;
}

/** Brings archived rows back. Returns how many changed. */
export async function restore(tx: Prisma.TransactionClient, model: ArchivableModel, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const r = await table(tx, model).updateMany({ where: { id: { in: ids }, archivedAt: { not: null } }, data: { archivedAt: null } });
  return r.count;
}
