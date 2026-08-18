import { TEMPLATE_NAME, LANGUAGE_CODE, buildComponents } from "./template";

export class WhatsAppSendError extends Error {
  detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.detail = detail;
  }
}

const MOCK_MODE = !(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

export async function sendTemplateMessage(to: string, sellerName: string): Promise<string> {
  if (MOCK_MODE) {
    return `mock.${crypto.randomUUID()}`;
  }

  const url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v20.0"}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: TEMPLATE_NAME,
        language: { code: LANGUAGE_CODE },
        components: buildComponents(sellerName),
      },
    }),
  });

  if (!res.ok) {
    throw new WhatsAppSendError(`WhatsApp API returned ${res.status}`, await res.text());
  }

  const data = await res.json();
  const id = data?.messages?.[0]?.id;
  if (!id) throw new WhatsAppSendError("Unexpected WhatsApp API response", JSON.stringify(data));
  return id;
}

export const isMockMode = MOCK_MODE;