import { z } from "zod";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { setSuspended } from "@/server/modules/admin/service";

// POST /api/admin/users/:id/suspend { reason } -> { status: "SUSPENDED" }; their sessions end at once
export const POST = route({
  auth: "user:suspend",
  body: z.object({ reason: z.string().trim().min(3, "Say why.").max(500) }),
  handler: async ({ ip, auth, body, params }) => ok(await setSuspended({ id: auth.user.id, ip }, String(params.id), true, body.reason)),
});
