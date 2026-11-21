import { limit } from "@/server/http/rate-limit";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { forgotSchema } from "@/server/modules/auth/schema";
import { forgotPassword } from "@/server/modules/auth/service";

// POST /api/auth/forgot-password { email } -> 200 always (never reveals whether the email exists)
export const POST = route({
  auth: "public",
  body: forgotSchema,
  limits: [{ key: "forgot", limit: 3, windowSeconds: 3600 }],
  handler: async ({ body }) => {
    await limit(`forgot:email:${body.email}`, 3, 3600);
    await forgotPassword(body.email);
    return ok({ ok: true });
  },
});
