import { NextResponse } from "next/server";
import { clearSessionCookie, loadSession, SESSION_COOKIE } from "@/server/auth/sessions";
import { handle } from "@/server/http/handler";
import { logout } from "@/server/modules/auth/service";

// POST /api/auth/logout -> 204, session revoked and cookie cleared.
export const POST = handle(async ({ request }) => {
  const s = await loadSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (s) await logout(s.session.id);
  const res = new NextResponse(null, { status: 204 });
  clearSessionCookie(res);
  return res;
});
