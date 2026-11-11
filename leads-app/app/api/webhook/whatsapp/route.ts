import { NextRequest, NextResponse } from "next/server";
import { env } from "@/server/env";
import { isValidWebhookSignature } from "@/server/modules/messaging/whatsapp/webhook-signature";
import {
  recordInboundMessage,
  recordStatusUpdate,
  type WebhookMessage,
  type WebhookStatus,
} from "@/server/modules/messaging/inbound";

interface WebhookPayload {
  entry?: { changes?: { value?: { messages?: WebhookMessage[]; statuses?: WebhookStatus[] } }[] }[];
}

// One-time handshake Meta does when the URL is registered in the dashboard.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const verifyToken = env().WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (verifyToken && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === verifyToken) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Verification failed", { status: 403 });
}

// Replies and delivery receipts. Meta expects a fast 200; classification happens later
// in the Python worker (ops.job_requests CLASSIFY_MESSAGE).
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

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const result = await recordInboundMessage(message);
        if (result === "unknown_sender") console.warn("[webhook] reply from a number that is not a known contact");
      }
      for (const status of change.value?.statuses ?? []) {
        await recordStatusUpdate(status);
      }
    }
  }

  return NextResponse.json({ status: "ok" });
}
