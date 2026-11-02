import "server-only";
import { cookies } from "next/headers";

/** Mock sign-in cookie. Holds only the mock user id; never used once the real auth routes are wired. */
export const MOCK_COOKIE = "leads_mock_session";

export async function mockUserId(): Promise<string | null> {
  return (await cookies()).get(MOCK_COOKIE)?.value ?? null;
}

export async function setMockSession(userId: string, remember: boolean): Promise<void> {
  (await cookies()).set(MOCK_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: 30 * 24 * 60 * 60 } : {}),
  });
}

export async function clearMockSession(): Promise<void> {
  (await cookies()).delete(MOCK_COOKIE);
}
