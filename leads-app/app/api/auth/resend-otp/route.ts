import { limit } from "@/server/http/rate-limit";
import { resendPhoneCode } from "@/server/modules/auth/phone";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";

// POST /api/auth/resend-otp -> { retryAfterSec } (WhatsApp code to the number being verified)
export const POST = route({
  auth: "session",
  handler: async ({ auth }) => {
    await limit(`resend-otp:user:${auth.user.id}`, 5, 3600);
    return ok(await resendPhoneCode(auth.user));
  },
});
