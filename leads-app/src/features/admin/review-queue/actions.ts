"use server";

import { z } from "zod";
import { done, failed } from "@/lib/admin/action-result";
import { BULK_MAX } from "@/lib/admin/constants";
import { adminAction } from "@/server/modules/admin/action";
import { approveListings } from "@/server/modules/admin/listings";
import { refreshAdminViews } from "@/server/modules/admin/refresh";

/** Approve (row and bulk): Live, and the customer gets the usual notification. */
export const approveListingsAction = adminAction(z.object({ ids: z.array(z.uuid()).min(1).max(BULK_MAX) }), async ({ ids }, actor) => {
  const n = await approveListings(actor, ids);
  refreshAdminViews();
  if (!n) return failed("That listing isn't waiting for review any more.");
  return done(n === 1 ? "Listing approved" : `${n} listings approved`);
});
