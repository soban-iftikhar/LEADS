import { body, handle, limit } from "@/server/http/handler";
import { successResponse } from "@/server/http/response";
import { forgotSchema } from "@/server/modules/auth/schema";
import { forgotPassword } from "@/server/modules/auth/service";

// POST /api/auth/forgot-password { email } -> 200 always (never reveals whether the email exists)
export const POST = handle(
  async ({ request }) => {
    const { email } = await body(request, forgotSchema);
    await limit(`forgot:email:${email}`, 3, 3600);
    await forgotPassword(email);
    return successResponse({ ok: true });
  },
  { limits: [{ key: "forgot", limit: 3, windowSeconds: 3600 }] },
);
