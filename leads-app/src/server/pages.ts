import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { currentAuth } from "@/server/auth/current";
import type { Auth } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";
import { isUuid } from "@/lib/ids";
import { getMe, ownerOf } from "@/server/modules/account/service";
import type { Owner } from "@/server/modules/listings/service";
import type { Me } from "@/types/api";

/**
 * Helpers for server components (pages and layouts). Pages read data by calling the services
 * directly with the signed-in customer's id; no HTTP round trip to our own API.
 */

export type Viewer = { auth: Auth; me: Me; owner: Owner };

const isCustomer = (auth: Auth) => !!auth.user.customer && (auth.user.role === "CUSTOMER_SELLER" || auth.user.role === "CUSTOMER_AGENCY");

/** The signed-in customer, or null (signed out, or an account that isn't a customer). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const auth = await currentAuth();
  if (!auth || !isCustomer(auth)) return null;
  return { auth, me: await getMe(auth.user.id), owner: ownerOf(auth.user) };
});

/** Guest-only pages: a signed-in customer goes on to the app (or to confirm their email first). */
export async function requireGuest(): Promise<void> {
  const v = await getViewer();
  if (v) redirect(v.me.user.emailVerified ? "/dashboard" : "/signup/verify");
}

/**
 * Customer pages: signed out -> /login?next=<path>; email not confirmed -> /signup/verify.
 * The WhatsApp number does not gate pages (DR-42); it gates listing review.
 */
export async function requireCustomer(path = "/dashboard"): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!v.me.user.emailVerified) redirect(`/signup/verify?next=${encodeURIComponent(path)}`);
  return v;
}

/** Signed in, email confirmed or not (the verification screens). */
export async function requireSignedIn(path: string): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect(`/login?next=${encodeURIComponent(path)}`);
  return v;
}

/** An id from the URL: anything that can't be a database id is simply not found. */
export function pageId(raw: string): string {
  if (!isUuid(raw)) notFound();
  return raw;
}

/** A service's 404 becomes the page's not-found screen. */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}
