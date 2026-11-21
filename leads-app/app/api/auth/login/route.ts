import { setAuthCookies } from "@/server/auth/cookies";
import { AppError, tooMany } from "@/server/http/errors";
import { hitRateLimit, peekRateLimit } from "@/server/http/rate-limit";
import { fail, ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { loginSchema } from "@/server/modules/auth/schema";
import { login } from "@/server/modules/auth/service";

const MAX_FAILS = 10;
const WINDOW_SEC = 900;

// POST /api/auth/login -> 200 { ok } + auth cookies; 403 { requiresEmailVerification } (still signed in, code re-sent).
// Only failed attempts count toward the limits (per IP and per email), so someone who logs in often is never blocked.
export const POST = route({
  auth: "public",
  body: loginSchema,
  handler: async ({ request, ip, body }) => {
    const keys = [`login-fail:ip:${ip}`, `login-fail:email:${body.email}`];
    for (const k of keys) if ((await peekRateLimit(k, WINDOW_SEC)) >= MAX_FAILS) throw tooMany(WINDOW_SEC);
    try {
      const r = await login(body.email, body.password, body.remember, { userAgent: request.headers.get("user-agent"), ip });
      const res = r.requiresEmailVerification ? fail("Confirm your email first. We sent you a new code.", 403, { requiresEmailVerification: "true" }) : ok({ ok: true });
      setAuthCookies(res, r.tokens);
      return res;
    } catch (e) {
      if (e instanceof AppError && e.status === 401) await Promise.all(keys.map((k) => hitRateLimit(k, WINDOW_SEC)));
      throw e;
    }
  },
});
