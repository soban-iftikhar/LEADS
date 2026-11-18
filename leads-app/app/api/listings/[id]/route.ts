import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { ownerOf } from "@/server/modules/account/service";
import { patchListingSchema } from "@/server/modules/listings/schema";
import { getMyListing, updateListing } from "@/server/modules/listings/service";

// GET /api/listings/:id -> ListingDetail
export const GET = route({ auth: "listing:read:own", handler: async ({ auth, params }) => ok(await getMyListing(ownerOf(auth.user), String(params.id))) });

// PATCH /api/listings/:id ListingPatch -> ListingDetail
export const PATCH = route({
  auth: "listing:update:own",
  body: patchListingSchema,
  limits: [{ key: "listing-patch", limit: 600, windowSeconds: 3600 }],
  handler: async ({ auth, body, params }) => ok(await updateListing(ownerOf(auth.user), String(params.id), body)),
});
