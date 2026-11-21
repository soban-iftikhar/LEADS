import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { resetSchema } from "@/server/modules/auth/schema";
import { resetPassword } from "@/server/modules/auth/service";

// POST /api/auth/reset-password { token, password } -> 200; 410 when the link is used or expired
export const POST = route({
  auth: "public",
  body: resetSchema,
  limits: [{ key: "reset", limit: 10, windowSeconds: 3600 }],
  handler: async ({ body }) => {
    await resetPassword(body.token, body.password);
    return ok({ ok: true });
  },
});
