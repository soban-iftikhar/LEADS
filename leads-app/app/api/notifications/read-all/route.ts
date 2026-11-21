import { noContent } from "@/server/http/response";
import { route } from "@/server/http/route";
import { readAll } from "@/server/modules/notifications/service";

// POST /api/notifications/read-all -> 204
export const POST = route({
  auth: "notification:read:own",
  handler: async ({ auth }) => {
    await readAll(auth.user.id);
    return noContent();
  },
});
