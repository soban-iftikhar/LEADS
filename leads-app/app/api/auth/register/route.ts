import { setAuthCookies } from "@/server/auth/cookies";
import { limit } from "@/server/http/rate-limit";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { registerSchema } from "@/server/modules/auth/schema";
import { register } from "@/server/modules/auth/service";

// POST /api/auth/register -> 201 { userId } + auth cookies; a 6-digit code goes to the email.
export const POST = route({
  auth: "public",
  body: registerSchema,
  limits: [{ key: "register", limit: 5, windowSeconds: 3600 }],
  handler: async ({ request, ip, body }) => {
    await limit(`register:email:${body.email}`, 3, 3600);
    const { userId, tokens } = await register(body, { userAgent: request.headers.get("user-agent"), ip });
    const res = ok({ userId }, 201);
    setAuthCookies(res, tokens);
    return res;
  },
});
