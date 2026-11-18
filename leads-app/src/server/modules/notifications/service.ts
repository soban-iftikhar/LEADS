import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { notFound } from "@/server/http/errors";
import { formatDate, formatPkr } from "@/lib/format";
import type { NotificationItem, NotificationType } from "@/types/api";

/**
 * In-app notifications (`ops.notifications`). A row stores the type and a small payload; the
 * title, text and link are rendered here, so wording changes never need a data migration.
 * The Python workers insert rows too (LEAD_DELIVERED, ORDER_ENDING, ORDER_ENDED, CASHBACK_PAID)
 * using exactly these payload shapes.
 */
export type Payloads = {
  LEAD_DELIVERED: { leadId: string; buyerName: string; listingTitle: string; localityName: string; said?: string | null };
  LISTING_IN_REVIEW: ListingPayload;
  LISTING_APPROVED: ListingPayload;
  LISTING_NEEDS_INFO: ListingPayload & { note?: string | null };
  LISTING_REJECTED: ListingPayload & { note?: string | null };
  ORDER_STARTED: { orderId: string; planName: string; leadCount: number; deliveryDays: number; windowEndsAt: string };
  ORDER_ENDING: { orderId: string; planName: string; daysLeft: number };
  ORDER_ENDED: { orderId: string; planName: string; deliveredCount: number; leadCount: number };
  CASHBACK_PAID: { orderId: string; amountPkr: string; undeliveredCount: number };
  REPORT_DECIDED: { leadId: string; buyerName: string; upheld: boolean };
};
type ListingPayload = { listingId: string; listingTitle: string; localityName: string };

type Rendered = Pick<NotificationItem, "title" | "body" | "href">;
const RENDER: { [T in NotificationType]: (p: Payloads[T]) => Rendered } = {
  LEAD_DELIVERED: (p) => ({ title: `New lead: ${p.buyerName}`, body: [`${p.listingTitle}, ${p.localityName}`, p.said ? `“${p.said}”` : null].filter(Boolean).join(" · "), href: `/leads/${p.leadId}` }),
  LISTING_IN_REVIEW: (p) => ({ title: `${cap(p.listingTitle)} is in review`, body: `${p.localityName} · usually done within 24 hours`, href: `/listings/${p.listingId}` }),
  LISTING_APPROVED: (p) => ({ title: `${cap(p.listingTitle)} is live`, body: `${p.localityName} · you can buy leads for it now`, href: `/listings/${p.listingId}` }),
  LISTING_NEEDS_INFO: (p) => ({ title: `${cap(p.listingTitle)} needs info`, body: [p.localityName, p.note].filter(Boolean).join(" · "), href: `/listings/${p.listingId}` }),
  LISTING_REJECTED: (p) => ({ title: `${cap(p.listingTitle)} was rejected`, body: [p.localityName, p.note].filter(Boolean).join(" · "), href: `/listings/${p.listingId}` }),
  ORDER_STARTED: (p) => ({ title: `${p.planName} package started`, body: `${p.leadCount} leads over ${p.deliveryDays} days, ends ${formatDate(p.windowEndsAt)}`, href: "/packages" }),
  ORDER_ENDING: (p) => ({ title: `${p.planName} package ends soon`, body: `${p.daysLeft} ${p.daysLeft === 1 ? "day" : "days"} left`, href: "/packages" }),
  ORDER_ENDED: (p) => ({ title: `${p.planName} package ended`, body: `${p.deliveredCount} of ${p.leadCount} leads delivered`, href: "/packages" }),
  CASHBACK_PAID: (p) => ({ title: "Cashback paid", body: `${formatPkr(p.amountPkr)} for ${p.undeliveredCount} undelivered ${p.undeliveredCount === 1 ? "lead" : "leads"}`, href: "/packages" }),
  REPORT_DECIDED: (p) => ({ title: p.upheld ? `Report accepted: ${p.buyerName}` : `Report declined: ${p.buyerName}`, body: p.upheld ? "This lead no longer counts toward your package." : "We checked and the lead is genuine.", href: `/leads/${p.leadId}` }),
};

const GROUPS: Record<string, NotificationType[]> = {
  lead: ["LEAD_DELIVERED", "REPORT_DECIDED"],
  listing: ["LISTING_IN_REVIEW", "LISTING_APPROVED", "LISTING_NEEDS_INFO", "LISTING_REJECTED"],
  package: ["ORDER_STARTED", "ORDER_ENDING", "ORDER_ENDED", "CASHBACK_PAID"],
};

const PAGE = 20;

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function render(row: { id: string; type: string; payload: Prisma.JsonValue; createdAt: Date; readAt: Date | null }): NotificationItem | null {
  const type = row.type as NotificationType;
  const fn = RENDER[type] as ((p: unknown) => Rendered) | undefined;
  if (!fn) return null; // a type this build doesn't know yet: skip it rather than show garbage
  return { id: row.id, type, ...fn(row.payload), createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null };
}

/** Adds a notification inside the caller's transaction (or on its own). */
export function notifyUser<T extends NotificationType>(db: Prisma.TransactionClient, userId: string, type: T, payload: Payloads[T]) {
  return db.notification.create({ data: { userId, type, payload: payload as Prisma.InputJsonValue } });
}

export async function listNotifications(userId: string, q: { type?: string; cursor?: string }) {
  const types = q.type ? GROUPS[q.type] : undefined;
  const where: Prisma.NotificationWhereInput = { userId, ...(types ? { type: { in: types } } : {}) };
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  const page = rows.slice(0, PAGE);
  return { items: page.map(render).filter((n): n is NotificationItem => n !== null), nextCursor: rows.length > PAGE ? page[page.length - 1].id : null, unread };
}

export const unreadCount = (userId: string) => prisma.notification.count({ where: { userId, readAt: null } });

export async function readAll(userId: string): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

export async function readOne(userId: string, id: string): Promise<void> {
  const { count } = await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  if (count === 0 && !(await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } }))) throw notFound();
}
