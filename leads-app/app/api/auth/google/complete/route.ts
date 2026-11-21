import { setAuthCookies } from "@/server/auth/cookies";
import { PENDING_COOKIE, unsign, type GoogleClaims } from "@/server/auth/google";
import { AppError } from "@/server/http/errors";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { googleCompleteSchema } from "@/server/modules/auth/schema";
import { createGoogleUser } from "@/server/modules/auth/service";

// POST /api/auth/google/complete { kind, agencyName?, acceptTerms } -> 201 + auth cookies (first Google sign-in)
export const POST = route({
  auth: "public",
  body: googleCompleteSchema,
  limits: [{ key: "google-complete", limit: 10, windowSeconds: 3600 }],
  handler: async ({ request, ip, body }) => {
    const profile = unsign<GoogleClaims>(request.cookies.get(PENDING_COOKIE)?.value);
    if (!profile) throw new AppError(410, "That Google sign-in has expired. Please start again.");
    const tokens = await createGoogleUser(profile, body.kind, body.agencyName, { userAgent: request.headers.get("user-agent"), ip });
    const res = ok({ ok: true }, 201);
    setAuthCookies(res, tokens);
    res.cookies.delete(PENDING_COOKIE);
    return res;
  },
});
