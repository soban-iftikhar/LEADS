import { PENDING_COOKIE, unsign, type GoogleClaims } from "@/server/auth/google";
import { ua } from "@/server/auth/current";
import { setSessionCookie } from "@/server/auth/sessions";
import { AppError } from "@/server/http/errors";
import { body, handle } from "@/server/http/handler";
import { successResponse } from "@/server/http/response";
import { googleCompleteSchema } from "@/server/modules/auth/schema";
import { createGoogleUser } from "@/server/modules/auth/service";

// POST /api/auth/google/complete { kind, agencyName?, acceptTerms } -> 201 + session (first Google sign-in)
export const POST = handle(
  async ({ request, ip }) => {
    const g = unsign<GoogleClaims>(request.cookies.get(PENDING_COOKIE)?.value);
    if (!g) throw new AppError(410, "That Google sign-in has expired. Please start again.");
    const input = await body(request, googleCompleteSchema);
    const { session } = await createGoogleUser(g, input.kind, input.agencyName, { userAgent: ua(request), ip });
    const res = successResponse({ ok: true }, 201);
    setSessionCookie(res, session);
    res.cookies.delete(PENDING_COOKIE);
    return res;
  },
  { limits: [{ key: "google-complete", limit: 10, windowSeconds: 3600 }] },
);
