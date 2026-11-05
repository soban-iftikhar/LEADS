import { requireSession } from "@/server/auth/current";
import { handle, limit } from "@/server/http/handler";
import { successResponse } from "@/server/http/response";
import { resendEmailCode } from "@/server/modules/auth/service";

// POST /api/auth/resend-email-code -> { retryAfterSec }
export const POST = handle(async ({ request }) => {
  const { user } = await requireSession(request);
  await limit(`resend-email:user:${user.id}`, 5, 3600);
  return successResponse(await resendEmailCode(user));
});
