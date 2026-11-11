import "server-only";
import crypto from "crypto";
import { env } from "@/server/env";

/**
 * Meta signs every webhook body with the app secret (header X-Hub-Signature-256).
 * Without this check anyone who knows the URL could post fake replies and statuses.
 *
 * Fails closed: in production a missing secret rejects every request. In development
 * a missing secret is allowed so the webhook can be tried locally.
 */
export function isValidWebhookSignature(rawBody: string, header: string | null): boolean {
  const { WHATSAPP_APP_SECRET, NODE_ENV } = env();
  if (!WHATSAPP_APP_SECRET) return NODE_ENV !== "production";
  if (!header?.startsWith("sha256=")) return false;

  const expected = crypto.createHmac("sha256", WHATSAPP_APP_SECRET).update(rawBody).digest();
  const received = Buffer.from(header.slice("sha256=".length), "hex");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}
