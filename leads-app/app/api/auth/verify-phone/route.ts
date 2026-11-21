import { verifyPhone } from "@/server/modules/auth/phone";
import { otpSchema } from "@/server/modules/auth/schema";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";

// POST /api/auth/verify-phone { otp } -> { phoneVerified: true }
export const POST = route({
  auth: "session",
  body: otpSchema,
  limits: [{ key: "verify-phone", limit: 20, windowSeconds: 900 }],
  handler: async ({ auth, body }) => {
    return ok(await verifyPhone(auth.user, body.otp));
  },
});
