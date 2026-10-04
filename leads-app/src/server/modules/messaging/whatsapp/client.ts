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
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...message }),
  });

  if (!res.ok) {
    throw new WhatsAppSendError(`WhatsApp API returned ${res.status}`, await res.text());
  }

  const data = await res.json();
  const id = data?.messages?.[0]?.id;
  if (!id) throw new WhatsAppSendError("Unexpected WhatsApp API response", JSON.stringify(data));
  return id;
}

/** Phone verification code. Returns false instead of throwing: signup continues by email. */
export async function sendWhatsAppOTP(phone: string, otp: string): Promise<boolean> {
  try {
    await send({
      to: phone,
      type: "text",
      text: {
        body: `Your LEADS verification code is: *${otp}*\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
      },
    });
    return true;
  } catch (error) {
    const detail = error instanceof WhatsAppSendError ? error.detail : String(error);
    console.error("WhatsApp OTP send failed:", detail);
    return false;
  }
}
