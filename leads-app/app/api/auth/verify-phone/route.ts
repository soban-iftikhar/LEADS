import { requireSession } from "@/server/auth/current";
import { body, handle } from "@/server/http/handler";
import { successResponse } from "@/server/http/response";
import { otpSchema } from "@/server/modules/auth/schema";
import { verifyPhone } from "@/server/modules/auth/service";

// POST /api/auth/verify-phone { otp } -> { phoneVerified: true }
export const POST = handle(
  async ({ request }) => {
    const { user } = await requireSession(request);
    const { otp } = await body(request, otpSchema);
    return successResponse(await verifyPhone(user, otp));
  },
  { limits: [{ key: "verify-phone", limit: 20, windowSeconds: 900 }] },
);
