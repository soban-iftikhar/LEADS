import { requireSession } from "@/server/auth/current";
import { body, handle, limit } from "@/server/http/handler";
import { successResponse } from "@/server/http/response";
import { phoneSchema } from "@/server/modules/auth/schema";
import { startPhone } from "@/server/modules/auth/service";

// POST /api/auth/phone { phone } -> WhatsApp code sent; { phoneMasked, retryAfterSec }
export const POST = handle(async ({ request }) => {
  const { user } = await requireSession(request);
  const { phone } = await body(request, phoneSchema);
  await limit(`phone:user:${user.id}`, 5, 3600);
  return successResponse(await startPhone(user, phone));
});
