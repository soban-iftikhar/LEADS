import "server-only";
import crypto from "node:crypto";
import { env } from "@/server/env";

/**
 * Client address for rate limiting.
 *
 * X-Forwarded-For is a list that every proxy appends to, so the left side is
 * whatever the caller chose to send and cannot be trusted. Only the entries
 * written by our own proxies are reliable: with N trusted proxies in front of
 * the app, the real client is the Nth entry from the right.
 *
 * Run the app behind a reverse proxy and set TRUSTED_PROXY_HOPS to match.
 * With no usable header every caller shares one bucket, which is strict but safe.
 */
export function clientIp(request: Pick<Request, "headers">): string {
  const hops = env().TRUSTED_PROXY_HOPS;
  const header = request.headers.get("x-forwarded-for");
  if (!header || hops < 1) return "unknown";

  const chain = header
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return chain[chain.length - hops] ?? chain[0] ?? "unknown";
}

/** Keyed hash of an address, for session rows and audit entries (never the address itself). */
export function hashIp(ip: string | undefined): string | null {
  const pepper = env().OTP_PEPPER;
  if (!ip || ip === "unknown" || !pepper) return null;
  return crypto.createHmac("sha256", Buffer.from(pepper, "base64")).update(ip).digest("hex").slice(0, 32);
}
