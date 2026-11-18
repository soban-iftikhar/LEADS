import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { ownerOf } from "@/server/modules/account/service";
import { listingActionSchema } from "@/server/modules/listings/schema";
import { applyOwnerAction } from "@/server/modules/listings/service";

// POST /api/listings/:id/status { action: pause | resume | mark-sold } -> { status }
export const POST = route({
  auth: "listing:pause:own",
  body: listingActionSchema,
  handler: async ({ auth, body, params }) => ok(await applyOwnerAction(ownerOf(auth.user), String(params.id), body.action)),
});
