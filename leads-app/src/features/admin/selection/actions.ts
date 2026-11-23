"use server";

import { z } from "zod";
import { done, failed } from "@/lib/admin/action-result";
import { BULK_MAX } from "@/lib/admin/constants";
import { adminAction } from "@/server/modules/admin/action";
import { refreshAdminViews } from "@/server/modules/admin/refresh";
import { inviteSellers } from "@/server/modules/admin/selection";

/** Invite (New only): starts outreach to each property's seller. */
export const inviteProperties = adminAction(z.object({ ids: z.array(z.uuid()).min(1).max(BULK_MAX) }), async ({ ids }, actor) => {
  const r = await inviteSellers(actor, ids);
  refreshAdminViews();
  if (!r.invited) return failed(r.noNumber ? "We don't have the seller's number for that property yet." : "Already invited.");
  const skipped = r.noNumber ? ` · ${r.noNumber} without a number skipped` : "";
  return done(r.invited === 1 ? `Invite sent to the seller${skipped}` : `${r.invited} invites sent${skipped}`);
});
