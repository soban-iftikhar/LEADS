import { noContent } from "@/server/http/response";
import { route } from "@/server/http/route";
import { ownerOf } from "@/server/modules/account/service";
import { deletePhoto } from "@/server/modules/listings/service";

// DELETE /api/listings/:id/images/:imageId -> 204
export const DELETE = route({
  auth: "listing:update:own",
  handler: async ({ auth, params }) => {
    await deletePhoto(ownerOf(auth.user), String(params.id), String(params.imageId));
    return noContent();
  },
});
