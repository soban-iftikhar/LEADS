import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "./cookies";
import { authFromAccessToken, type Auth } from "./session";

/** Signed-in session for a route handler, or null. */
export function authFromRequest(request: NextRequest): Promise<Auth | null> {
  return authFromAccessToken(request.cookies.get(ACCESS_COOKIE)?.value);
}

/** Signed-in session for server components (memoised for one render), or null. */
export const currentAuth = cache(async (): Promise<Auth | null> => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  return authFromAccessToken(token);
});
