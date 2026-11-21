import { noContent } from "@/server/http/response";
import { route } from "@/server/http/route";
import { readOne } from "@/server/modules/notifications/service";

// PATCH /api/notifications/:id -> 204 (marks it read)
export const PATCH = route({
  auth: "notification:read:own",
  handler: async ({ auth, params }) => {
    await readOne(auth.user.id, String(params.id));
    return noContent();
  },
});
