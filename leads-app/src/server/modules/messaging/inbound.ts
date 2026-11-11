import "server-only";
import { Prisma, type MessageStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { hashPhone, normalizePhone } from "@/server/crypto/phone";

/** The parts of Meta's webhook payload LEADS reads. */
export interface WebhookMessage {
  id: string;
  from: string; // international format, e.g. "923001234567"
  type: string;
  text?: { body?: string };
}
export interface WebhookStatus {
  id: string;
  status: string; // "sent" | "delivered" | "read" | "failed"
}

const STATUS: Record<string, MessageStatus> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

/**
 * Stores a reply from a contact we know and queues it for the classifier (SPEC_00 4.5).
 * Contacts are matched by phone hash, so no plain phone number is stored or logged.
 * Meta retries webhooks: a message id already stored is skipped, never stored twice.
 * Returns what happened, for logging.
 */
export async function recordInboundMessage(message: WebhookMessage): Promise<"stored" | "duplicate" | "unknown_sender"> {
  const pepper = env().PHONE_HASH_PEPPER;
  const phone = normalizePhone(message.from);
  if (!pepper || !phone) return "unknown_sender";

  const contact = await prisma.contact.findUnique({
    where: { phoneHash: hashPhone(phone, pepper) },
    select: { id: true },
  });
  if (!contact) return "unknown_sender";

  const body = message.type === "text" ? (message.text?.body ?? "") : `[${message.type} message]`;
  try {
    await prisma.$transaction([
      prisma.message.create({
        data: {
          contactId: contact.id,
          direction: "IN",
          channel: "WA_API",
          body,
          waMessageId: message.id,
          status: "RECEIVED",
        },
      }),
      prisma.jobRequest.create({
        data: {
          type: "CLASSIFY_MESSAGE",
          payload: { waMessageId: message.id },
          dedupeKey: `classify:${message.id}`,
        },
      }),
    ]);
    return "stored";
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "duplicate";
    throw error;
  }
}

/** Delivery receipt for a message we sent. Unknown ids (e.g. OTP texts) are ignored. */
export async function recordStatusUpdate(status: WebhookStatus): Promise<void> {
  const next = STATUS[status.status];
  if (!next) return;
  await prisma.message.updateMany({ where: { waMessageId: status.id }, data: { status: next } });
}
