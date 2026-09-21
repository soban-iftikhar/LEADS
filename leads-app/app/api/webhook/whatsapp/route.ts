import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { isValidWebhookSignature } from "@/server/modules/messaging/whatsapp/webhook-signature";
import { normalizeForWhatsApp } from "@/server/modules/messaging/whatsapp/phone";
import { env } from "@/server/env";

// The parts of Meta's webhook payload this handler reads.
interface WebhookMessage {
  from: string; // e.g. "923001234567"
  type: string;
  text?: { body?: string };
}
interface WebhookStatus {
  id: string;
  status: string; // "sent" | "delivered" | "read" | "failed"
}
interface WebhookPayload {
  entry?: { changes?: { value?: { messages?: WebhookMessage[]; statuses?: WebhookStatus[] } }[] }[];
}

// One-time handshake Meta does when you register this URL in the dashboard.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge") || "";

  if (mode === "subscribe" && token === env().WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Verification failed", { status: 403 });
}

// Ongoing traffic — Meta expects a fast 200
export async function POST(req: NextRequest) {
  // Read the raw text first: the signature is computed over the exact bytes Meta sent.
  const rawBody = await req.text();
  if (!isValidWebhookSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};

      for (const message of value.messages || []) {
        await handleIncomingMessage(message);
      }
      for (const status of value.statuses || []) {
        await handleStatusUpdate(status);
      }
    }
  }

  return NextResponse.json({ status: "ok" });
}

async function handleIncomingMessage(message: WebhookMessage) {
  const from = message.from; // e.g. "923001234567"
  const text = message.type === "text" ? message.text?.body ?? "" : `[${message.type} message]`;

  // Prospect.contact is stored in local format (e.g. "0300-1234567"), not
  // the international format WhatsApp sends "from" in — so this can't be a
  // direct DB-level match. At current scale, filtering CONTACTED prospects
  // in memory is simple and correct;

  const candidates = await prisma.legacyProspect.findMany({ where: { status: "CONTACTED" } });
  const match = candidates.find((p: { contact: string | null }) => normalizeForWhatsApp(p.contact) === from);

  if (!match) {
    console.warn("[webhook] Inbound message did not match any contacted prospect");
    return;
  }

  await prisma.legacyProspect.update({
    where: { id: match.id },
    data: { status: "REPLIED", repliedAt: new Date(), lastReplyText: text },
  });
}

async function handleStatusUpdate(status: WebhookStatus) {
  const waMessageId = status.id;
  const newStatus = status.status; // "sent" | "delivered" | "read" | "failed"

  const prospect = await prisma.legacyProspect.findFirst({ where: { waMessageId } });
  if (!prospect) return;

  console.log(`[webhook] Prospect ${prospect.id} outreach message is now "${newStatus}"`);
}