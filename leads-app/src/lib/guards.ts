import "server-only";
import { redirect } from "next/navigation";
import type { Me } from "@/types/api";
import { getViewer } from "./viewer";

/** Guest-only pages: a signed-in customer goes to the dashboard. */
export async function requireGuest(): Promise<void> {
  const me = await getViewer();
  if (me) redirect(me.user.phoneVerified ? "/dashboard" : "/signup/verify");
}

/**
 * Customer pages: signed out -> /login?next=<path>; phone not verified -> /signup/verify.
 * Non-customer roles never reach here (the mock only has customers; the real /api/me returns 403).
 */
export async function requireCustomer(path: string): Promise<Me> {
  const me = await getViewer();
  if (!me) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!me.user.phoneVerified) redirect("/signup/verify");
  return me;
}
