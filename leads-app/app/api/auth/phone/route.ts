import { limit } from "@/server/http/rate-limit";
import { startPhone } from "@/server/modules/auth/phone";
import { phoneSchema } from "@/server/modules/auth/schema";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";

// POST /api/auth/phone { phone } -> WhatsApp code sent; { phoneMasked, retryAfterSec }
export const POST = route({
  auth: "session",
  body: phoneSchema,
  handler: async ({ auth, body }) => {
    await limit(`phone:user:${auth.user.id}`, 5, 3600);
    return ok(await startPhone(auth.user, body.phone));
  },
});
