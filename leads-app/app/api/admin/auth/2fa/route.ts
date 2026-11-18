import { z } from "zod";
import { unauthenticated } from "@/server/http/errors";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { adminSecondFactor } from "@/server/modules/auth/service";

// POST /api/admin/auth/2fa { code } -> { ok } once the authenticator code matches.
// "public" because the session is not usable for anything else until this passes.
export const POST = route({
  auth: "public",
  body: z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.") }),
  limits: [{ key: "admin-2fa", limit: 10, windowSeconds: 900 }],
  handler: async ({ request, ip, auth, body }) => {
    if (!auth) throw unauthenticated();
    await adminSecondFactor(auth.user, auth.session.id, body.code, { userAgent: request.headers.get("user-agent"), ip });
    return ok({ ok: true });
  },
});
