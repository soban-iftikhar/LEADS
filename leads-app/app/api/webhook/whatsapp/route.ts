import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeForWhatsApp } from "@/lib/whatsapp/phone";

// One-time handshake Meta does when you register this URL in the dashboard.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge") || "";

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Verification failed", { status: 403 });
}

// Ongoing traffic — Meta expects a fast 200
export async function POST(req: NextRequest) {
  const payload = await req.json();

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

async function handleIncomingMessage(message: any) {
  const from = message.from as string; // e.g. "923001234567"
  const text = message.type === "text" ? message.text?.body ?? "" : `[${message.type} message]`;

  // Prospect.contact is stored in local format (e.g. "0300-1234567"), not
  // the international format WhatsApp sends "from" in — so this can't be a
  // direct DB-level match. At current scale, filtering CONTACTED prospects
  // in memory is simple and correct;

  const candidates = await prisma.prospect.findMany({ where: { status: "CONTACTED" } });
  const match = candidates.find((p: { contact: string | null }) => normalizeForWhatsApp(p.contact) === from);

  if (!match) {
    console.warn(`[webhook] No CONTACTED prospect found for inbound message from ${from}`);
    return;
  }

  await prisma.prospect.update({
    where: { id: match.id },
    data: { status: "REPLIED", repliedAt: new Date(), lastReplyText: text },
  });
}

async function handleStatusUpdate(status: any) {
  const waMessageId = status.id as string;
  const newStatus = status.status as string; // "sent" | "delivered" | "read" | "failed"

  const prospect = await prisma.prospect.findFirst({ where: { waMessageId } });
  if (!prospect) return;

  console.log(`[webhook] Prospect ${prospect.id} outreach message is now "${newStatus}"`);
}