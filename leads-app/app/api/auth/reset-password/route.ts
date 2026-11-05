import { body, handle } from "@/server/http/handler";
import { successResponse } from "@/server/http/response";
import { resetSchema } from "@/server/modules/auth/schema";
import { resetPassword } from "@/server/modules/auth/service";

// POST /api/auth/reset-password { token, password } -> 200; 410 when the link is used or expired
export const POST = handle(
  async ({ request }) => {
    const { token, password } = await body(request, resetSchema);
    await resetPassword(token, password);
    return successResponse({ ok: true });
  },
  { limits: [{ key: "reset", limit: 10, windowSeconds: 3600 }] },
);
