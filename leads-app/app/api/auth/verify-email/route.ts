import { requireSession } from "@/server/auth/current";
import { body, handle } from "@/server/http/handler";
import { successResponse } from "@/server/http/response";
import { codeSchema } from "@/server/modules/auth/schema";
import { verifyEmail } from "@/server/modules/auth/service";

// POST /api/auth/verify-email { code } -> { emailVerified: true }
export const POST = handle(
  async ({ request }) => {
    const { user } = await requireSession(request);
    const { code } = await body(request, codeSchema);
    return successResponse(await verifyEmail(user, code));
  },
  { limits: [{ key: "verify-email", limit: 20, windowSeconds: 900 }] },
);
