import "server-only";
import type { NextRequest } from "next/server";
import { unauthenticated } from "@/server/http/errors";
import { loadSession, SESSION_COOKIE } from "./sessions";

/** Session for a route handler, or a 401. */
export async function requireSession(request: NextRequest) {
  const s = await loadSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!s) throw unauthenticated();
  return s;
}

export const ua = (request: NextRequest) => request.headers.get("user-agent");
