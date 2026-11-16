import "server-only";
import { redirect } from "next/navigation";
import type { Me } from "@/types/api";
import { getViewer } from "./viewer";

/** Guest-only pages: a signed-in customer goes on to the app (or to confirm their email first). */
export async function requireGuest(): Promise<void> {
  const me = await getViewer();
  if (me) redirect(me.user.emailVerified ? "/dashboard" : "/signup/verify");
}

/**
 * Customer pages: signed out -> /login?next=<path>; email not confirmed -> /signup/verify.
 * The WhatsApp number does not gate pages (DR-42); it gates listing review and the free trial.
 */
export async function requireCustomer(path: string): Promise<Me> {
  const me = await getViewer();
  if (!me) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!me.user.emailVerified) redirect(`/signup/verify?next=${encodeURIComponent(path)}`);
  return me;
}
