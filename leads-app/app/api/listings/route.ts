import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { ownerOf } from "@/server/modules/account/service";
import { createListingSchema } from "@/server/modules/listings/schema";
import { createListing } from "@/server/modules/listings/service";

// POST /api/listings { category } -> 201 { id } (a DRAFT)
export const POST = route({
  auth: "listing:create",
  body: createListingSchema,
  limits: [{ key: "listing-create", limit: 30, windowSeconds: 3600 }],
  handler: async ({ auth, body }) => ok(await createListing(ownerOf(auth.user), body.category), 201),
});
