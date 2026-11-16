import { requireSession } from "@/server/auth/current";
import { handle, limit } from "@/server/http/handler";
import { successResponse } from "@/server/http/response";
import { resendPhoneCode } from "@/server/modules/auth/service";

// POST /api/auth/resend-otp -> { retryAfterSec } (WhatsApp code to the number being verified)
export const POST = handle(async ({ request }) => {
  const { user } = await requireSession(request);
  await limit(`resend-otp:user:${user.id}`, 5, 3600);
  return successResponse(await resendPhoneCode(user));
});
