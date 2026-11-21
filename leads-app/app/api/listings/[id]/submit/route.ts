import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { ownerOf } from "@/server/modules/account/service";
import { submitListing } from "@/server/modules/listings/service";

// POST /api/listings/:id/submit -> { status: "UNDER_REVIEW" }; 422 { checks } when the quality gate fails
export const POST = route({ auth: "listing:submit:own", handler: async ({ auth, params }) => ok(await submitListing(ownerOf(auth.user), String(params.id))) });
