import { codeSchema } from "@/server/modules/auth/schema";
import { verifyEmail } from "@/server/modules/auth/service";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";

// POST /api/auth/verify-email { code } -> { emailVerified: true }
export const POST = route({
  auth: "session",
  body: codeSchema,
  limits: [{ key: "verify-email", limit: 20, windowSeconds: 900 }],
  handler: async ({ auth, body }) => {
    return ok(await verifyEmail(auth.user, body.code));
  },
});
