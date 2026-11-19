import "server-only";
import { headers } from "next/headers";
import { currentAuth } from "@/server/auth/current";
import { clientIp } from "@/server/http/client-ip";
import { forbidden, unauthenticated } from "@/server/http/errors";

export type AdminActor = { id: string; name: string; ip?: string };

/**
 * The role check inside every admin server action. The layout already checked it, but an
 * action is its own HTTP endpoint and can be called without the page.
 */
export async function requireAdminActor(): Promise<AdminActor> {
  const auth = await currentAuth();
  if (!auth) throw unauthenticated("Your session ended. Sign in again.");
  if (auth.user.role !== "ADMIN" || !auth.session.twoFactorPassed) throw forbidden();
  return { id: auth.user.id, name: auth.user.fullName, ip: clientIp({ headers: await headers() }) };
}
