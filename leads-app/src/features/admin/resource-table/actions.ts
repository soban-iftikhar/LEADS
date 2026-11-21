"use server";

import { z } from "zod";
import { done } from "@/lib/admin/action-result";
import { BULK_MAX } from "@/lib/admin/constants";
import { adminAction } from "@/server/modules/admin/action";
import { archivableResource } from "@/server/modules/admin/archivable";
import { archiveRecords, restoreRecords } from "@/server/modules/admin/records";
import { refreshAdminViews } from "@/server/modules/admin/refresh";

const selection = z.object({ resource: z.string().min(1).max(40), ids: z.array(z.uuid()).min(1).max(BULK_MAX) });

/** Soft delete from any list: hidden, kept, restorable from the Archived tab. */
export const archiveRecord = adminAction(selection, async ({ resource, ids }, actor) => {
  const { model, noun } = archivableResource(resource);
  const n = await archiveRecords(actor, model, ids, noun);
  refreshAdminViews();
  return done(n ? "Archived" : "Already archived", { undo: n > 0 });
});

export const restoreRecord = adminAction(selection, async ({ resource, ids }, actor) => {
  const { model, noun } = archivableResource(resource);
  const n = await restoreRecords(actor, model, ids, noun);
  refreshAdminViews();
  return done(n ? "Restored" : "Already restored");
});
