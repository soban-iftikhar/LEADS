import { noContent } from "@/server/http/response";
import { route } from "@/server/http/route";
import { ownerOf } from "@/server/modules/account/service";
import { reorderImagesSchema } from "@/server/modules/listings/schema";
import { reorderPhotos } from "@/server/modules/listings/service";

// PATCH /api/listings/:id/images/order { ids } -> 204 (every photo id, in the new order)
export const PATCH = route({
  auth: "listing:update:own",
  body: reorderImagesSchema,
  handler: async ({ auth, body, params }) => {
    await reorderPhotos(ownerOf(auth.user), String(params.id), body.ids);
    return noContent();
  },
});
