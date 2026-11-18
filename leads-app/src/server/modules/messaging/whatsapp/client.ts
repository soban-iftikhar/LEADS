import "server-only";
import { env } from "@/server/env";

export class WhatsAppSendError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
    this.name = "WhatsAppSendError";
  }
}

/**
 * The web app only sends verification codes. Outreach and campaign messages are sent by
 * the Python messaging worker through its MessageChannel (SPEC_00 4.4).
 *
 * Returns the WhatsApp message id.
 */
async function send(message: Record<string, unknown>): Promise<string> {
  const { WHATSAPP_API_VERSION, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TOKEN } = env();
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) throw new WhatsAppSendError("WhatsApp is not configured");
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...message }),
  });
  if (!res.ok) throw new WhatsAppSendError(`WhatsApp API returned ${res.status}`, await res.text());
  const data = (await res.json()) as { messages?: { id?: string }[] };
  const id = data?.messages?.[0]?.id;
  if (!id) throw new WhatsAppSendError("Unexpected WhatsApp API response", JSON.stringify(data));
  return id;
}

/** "03001234567" -> "923001234567" (the Cloud API wants digits only, country code first). */
export function toWaRecipient(local: string): string {
  return "92" + local.replace(/\D/g, "").replace(/^0/, "");
}

/**
 * Sends a verification code. Uses the approved AUTHENTICATION template when one is configured
 * (needed for business-initiated messages); otherwise plain text, which WhatsApp only delivers
 * inside a 24-hour customer window. Throws WhatsAppSendError on failure.
 */
export async function sendWhatsAppCode(localPhone: string, code: string): Promise<string> {
  const { WHATSAPP_OTP_TEMPLATE, WHATSAPP_OTP_TEMPLATE_LANG } = env();
  const to = toWaRecipient(localPhone);
  if (WHATSAPP_OTP_TEMPLATE) {
    return send({
      to,
      type: "template",
      template: {
        name: WHATSAPP_OTP_TEMPLATE,
        language: { code: WHATSAPP_OTP_TEMPLATE_LANG },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    });
  }
  return send({
    to,
    type: "text",
    text: { body: `Your LEADS code is *${code}*. It works for 10 minutes. Don't share it with anyone.` },
  });
}
