import "server-only";
import type { ArchivableModel } from "@/server/db/soft-delete";
import { notFound } from "@/server/http/errors";

/** List screens whose rows can be archived: resource key -> table and the noun for messages. */
const ARCHIVABLE: Record<string, { model: ArchivableModel; noun: string }> = {
  selection: { model: "masterListing", noun: "property" },
};

export function archivableResource(resource: string): { model: ArchivableModel; noun: string } {
  const entry = Object.hasOwn(ARCHIVABLE, resource) ? ARCHIVABLE[resource] : undefined;
  if (!entry) throw notFound("That list can't archive rows.");
  return entry;
}
