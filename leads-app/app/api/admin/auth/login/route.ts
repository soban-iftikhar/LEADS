import { z } from "zod";
import { setAuthCookies } from "@/server/auth/cookies";
import { AppError, tooMany } from "@/server/http/errors";
import { hitRateLimit, peekRateLimit } from "@/server/http/rate-limit";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { adminLogin } from "@/server/modules/auth/service";

const WINDOW_SEC = 900;

// POST /api/admin/auth/login { email, password } -> { twoFactorRequired: true } + cookies for step 2 (DR-38)
export const POST = route({
  auth: "public",
  body: z.object({ email: z.string().trim().toLowerCase().email().max(255), password: z.string().min(1).max(200) }),
  limits: [{ key: "admin-login", limit: 20, windowSeconds: WINDOW_SEC }],
  handler: async ({ request, ip, body }) => {
    const keys = [`admin-login-fail:ip:${ip}`, `admin-login-fail:email:${body.email}`];
    for (const k of keys) if ((await peekRateLimit(k, WINDOW_SEC)) >= 5) throw tooMany(WINDOW_SEC);
    try {
      const res = ok({ twoFactorRequired: true });
      setAuthCookies(res, await adminLogin(body.email, body.password, { userAgent: request.headers.get("user-agent"), ip }));
      return res;
    } catch (e) {
      if (e instanceof AppError && e.status === 401) await Promise.all(keys.map((k) => hitRateLimit(k, WINDOW_SEC)));
      throw e;
    }
  },
});
