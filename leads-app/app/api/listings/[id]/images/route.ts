import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { ownerOf } from "@/server/modules/account/service";
import { addPhoto } from "@/server/modules/listings/service";
import { fileFrom, PHOTO_MAX_BYTES } from "@/server/modules/listings/uploads";

// POST /api/listings/:id/images multipart { file } -> 201 { image: { id, url, position } }
export const POST = route({
  auth: "listing:update:own",
  limits: [{ key: "listing-photo", limit: 120, windowSeconds: 3600 }],
  handler: async ({ request, auth, params }) => {
    const { file } = await fileFrom(request, PHOTO_MAX_BYTES);
    return ok(await addPhoto(ownerOf(auth.user), String(params.id), file), 201);
  },
});
