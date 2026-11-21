import { limit } from "@/server/http/rate-limit";
import { resendEmailCode } from "@/server/modules/auth/service";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";

// POST /api/auth/resend-email-code -> { retryAfterSec }
export const POST = route({
  auth: "session",
  handler: async ({ auth }) => {
    await limit(`resend-email:user:${auth.user.id}`, 5, 3600);
    return ok(await resendEmailCode(auth.user));
  },
});
