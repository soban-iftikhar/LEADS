import type { NextResponse } from "next/server";
import { ua } from "@/server/auth/current";
import { setSessionCookie } from "@/server/auth/sessions";
import { AppError, tooMany } from "@/server/http/errors";
import { body, handle, limit } from "@/server/http/handler";
import { peekRateLimit } from "@/server/http/rate-limit";
import { errorResponse, successResponse } from "@/server/http/response";
import { loginSchema } from "@/server/modules/auth/schema";
import { login } from "@/server/modules/auth/service";

const MAX_FAILS = 10;
const WINDOW = 900;

// POST /api/auth/login -> 200 { ok } + cookie; 403 { requiresEmailVerification } (cookie still set, code re-sent).
// Rate limits count failed attempts only (per IP and per email), so a person who logs in often is never blocked.
export const POST = handle(async ({ request, ip }) => {
  const input = await body(request, loginSchema);
  const keys = [`login-fail:ip:${ip}`, `login-fail:email:${input.email}`];
  for (const k of keys) if ((await peekRateLimit(k)) >= MAX_FAILS) throw tooMany(WINDOW);
  try {
    const r = await login(input.email, input.password, input.remember, { userAgent: ua(request), ip });
    const res: NextResponse = r.requiresEmailVerification
      ? errorResponse("Confirm your email first. We sent you a new code.", 403, { requiresEmailVerification: "true" })
      : successResponse({ ok: true });
    setSessionCookie(res, r.session);
    return res;
  } catch (e) {
    if (e instanceof AppError && e.status === 401) for (const k of keys) await limit(k, Number.MAX_SAFE_INTEGER, WINDOW);
    throw e;
  }
});
