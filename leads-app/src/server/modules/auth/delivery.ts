import "server-only";
import { deliveryIsLogged, isProduction } from "@/server/env";
import { AppError } from "@/server/http/errors";
import { WhatsAppSendError } from "@/server/modules/messaging/whatsapp/client";

/**
 * Sends a one-time code or link. With AUTH_DELIVERY=log (local tests) nothing is sent and the
 * secret is printed to the server log. Outside production a failed send also falls back to the
 * log, so the flow stays testable without provider keys; in production the caller gets a 502.
 */
export async function deliverSecret(what: string, to: string, secret: string, send: () => Promise<unknown>): Promise<void> {
  if (deliveryIsLogged()) {
    console.info(`[auth] ${what} to ${to} not sent (AUTH_DELIVERY=log). The code is: ${secret}`);
    return;
  }
  try {
    await send();
  } catch (e) {
    const detail = e instanceof WhatsAppSendError ? `${e.message} ${e.detail ?? ""}` : String(e);
    if (!isProduction()) {
      console.warn(`[auth] ${what} to ${to} failed (${detail.slice(0, 300)}). Development fallback, the code is: ${secret}`);
      return;
    }
    console.error(`[auth] ${what} failed:`, detail.slice(0, 300));
    throw new AppError(502, "We couldn't send the code right now. Try again in a minute.");
  }
}

/** Notices (password changed, login paused): best effort, never blocks the request, silent in log mode. */
export function notify(what: string, send: () => Promise<unknown>): void {
  if (deliveryIsLogged()) return;
  send().catch((e) => console.error(`[auth] ${what} failed:`, String(e).slice(0, 300)));
}
