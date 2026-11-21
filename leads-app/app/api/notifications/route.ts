import { z } from "zod";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { listNotifications } from "@/server/modules/notifications/service";

// GET /api/notifications?type=lead|listing|package&cursor -> { items, nextCursor, unread }
export const GET = route({
  auth: "notification:read:own",
  query: z.object({ type: z.enum(["lead", "listing", "package"]).optional(), cursor: z.uuid().optional() }),
  handler: async ({ auth, query }) => ok(await listNotifications(auth.user.id, query)),
});
