import { clearAuthCookies, REFRESH_COOKIE } from "@/server/auth/cookies";
import { sessionIdForRefreshToken } from "@/server/auth/session";
import { noContent } from "@/server/http/response";
import { route } from "@/server/http/route";
import { logout } from "@/server/modules/auth/service";

// POST /api/auth/logout -> 204, session revoked and both cookies cleared. Works with either token,
// so a browser whose access token already expired can still sign out.
export const POST = route({
  auth: "public",
  handler: async ({ request, auth }) => {
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
    const sessionId = auth?.session.id ?? (refresh ? (await sessionIdForRefreshToken(refresh))?.id : undefined);
    if (sessionId) await logout(sessionId);
    const res = noContent();
    clearAuthCookies(res);
    return res;
  },
});
