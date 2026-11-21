import "server-only";
import type { Prisma, ReviewDecision, Role, UserStatus } from "@prisma/client";
import { revokeAllSessions } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { conflict, forbidden, notFound } from "@/server/http/errors";
import { audit } from "@/server/modules/audit/service";
import { notifyUser } from "@/server/modules/notifications/service";
import { confirmPayment } from "@/server/modules/orders/service";

/**
 * The operations team's work queue (DR-14, SPEC_02 5.11-5.12): listing review, bank-transfer
 * confirmation and account suspension. Every change is written to the audit log.
 */

type Actor = { id: string; ip?: string };

// ---------------------------------------------------------------- listing review

export async function reviewQueue() {
  const rows = await prisma.listing.findMany({
    where: { status: "UNDER_REVIEW" },
    orderBy: { updatedAt: "asc" },
    take: 100,
    include: {
      customer: { select: { id: true, email: true, phoneVerifiedAt: true, customer: { select: { kind: true, displayName: true } } } },
      locality: { select: { name: true } },
      region: { select: { name: true } },
      images: { orderBy: { position: "asc" }, select: { url: true } },
      documents: { select: { id: true, kind: true, fileName: true, uploadedAt: true } },
    },
  });
  return rows.map((l) => ({
    id: l.id,
    title: l.title,
    category: l.category,
    pricePkr: l.pricePkr?.toString() ?? null,
    sizeValue: l.sizeValue?.toString() ?? null,
    sizeUnit: l.sizeUnit,
    locality: l.locality?.name ?? null,
    region: l.region.name,
    description: l.description,
    ownerName: l.ownerName,
    reReview: l.publishedAt !== null,
    submittedAt: l.updatedAt.toISOString(),
    customer: { id: l.customer.id, email: l.customer.email, kind: l.customer.customer?.kind ?? null, displayName: l.customer.customer?.displayName ?? null, phoneVerified: !!l.customer.phoneVerifiedAt },
    images: l.images.map((i) => i.url),
    documents: l.documents.map((d) => ({ ...d, uploadedAt: d.uploadedAt.toISOString() })),
  }));
}

const DECISION = {
  APPROVE: { status: "APPROVED", notice: "LISTING_APPROVED" },
  REJECT: { status: "REJECTED", notice: "LISTING_REJECTED" },
  NEED_INFO: { status: "NEEDS_INFO", notice: "LISTING_NEEDS_INFO" },
} as const;

export async function reviewListing(actor: Actor, listingId: string, decision: ReviewDecision, note: string | undefined) {
  return prisma.$transaction(async (tx) => {
    const l = await tx.listing.findUnique({ where: { id: listingId }, include: { locality: { select: { name: true } } } });
    if (!l) throw notFound("We couldn't find that listing.");
    if (l.status !== "UNDER_REVIEW") throw conflict("This listing isn't waiting for review.");
    const d = DECISION[decision];
    await tx.listing.update({
      where: { id: l.id },
      data: { status: d.status, rejectionReason: decision === "REJECT" ? note ?? null : null, ...(decision === "APPROVE" && !l.publishedAt ? { publishedAt: new Date() } : {}) },
    });
    await tx.listingReview.create({ data: { listingId: l.id, adminId: actor.id, decision, note: note ?? null } });
    await tx.listingStatusEvent.create({ data: { listingId: l.id, status: d.status } });
    const payload = { listingId: l.id, listingTitle: l.title, localityName: l.locality?.name ?? "" };
    if (d.notice === "LISTING_APPROVED") await notifyUser(tx, l.customerId, "LISTING_APPROVED", payload);
    else await notifyUser(tx, l.customerId, d.notice, { ...payload, note: note ?? null });
    await audit(tx, { actorId: actor.id, action: "listing.reviewed", entity: "listing", entityId: l.id, before: { status: l.status }, after: { status: d.status, decision }, ip: actor.ip });
    return { status: d.status };
  });
}

// ---------------------------------------------------------------- payments

export async function pendingPayments() {
  const rows = await prisma.payment.findMany({
    where: { status: "PENDING", order: { status: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "asc" },
    include: { order: { include: { packagePlan: { select: { name: true } }, listing: { select: { title: true } }, customer: { select: { email: true } } } } },
  });
  return rows.map((p) => ({
    id: p.id,
    provider: p.provider,
    reference: p.providerRef,
    amountPkr: p.amountPkr.toString(),
    createdAt: p.createdAt.toISOString(),
    order: { id: p.order.id, planName: p.order.packagePlan.name, listingTitle: p.order.listing.title, customerEmail: p.order.customer.email },
  }));
}

export async function confirmPaymentAsAdmin(actor: Actor, paymentId: string) {
  const order = await confirmPayment(paymentId);
  await audit(prisma, { actorId: actor.id, action: "payment.confirmed", entity: "payment", entityId: paymentId, after: { orderId: order.id, status: order.status }, ip: actor.ip });
  return { orderId: order.id, status: order.status };
}

// ---------------------------------------------------------------- users

const PAGE = 50;

export async function listUsers(q: { q?: string; role?: Role; status?: UserStatus; cursor?: string }) {
  const where: Prisma.UserWhereInput = {
    ...(q.role ? { role: q.role } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.q ? { OR: [{ email: { contains: q.q, mode: "insensitive" } }, { fullName: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    // never hashes, codes or phone values
    select: { id: true, email: true, fullName: true, role: true, status: true, emailVerifiedAt: true, phoneVerifiedAt: true, suspendedAt: true, suspendedReason: true, lastLoginAt: true, createdAt: true, customer: { select: { kind: true, displayName: true } } },
  });
  const page = rows.slice(0, PAGE);
  return { items: page, nextCursor: rows.length > PAGE ? page[page.length - 1].id : null };
}

export async function setSuspended(actor: Actor, userId: string, suspend: boolean, reason?: string) {
  if (userId === actor.id) throw forbidden("You can't suspend your own account.");
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.status === "DELETED") throw notFound("We couldn't find that user.");
  if (suspend === (u.status === "SUSPENDED")) throw conflict(suspend ? "This account is already suspended." : "This account isn't suspended.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: u.id }, data: suspend ? { status: "SUSPENDED", suspendedAt: new Date(), suspendedReason: reason ?? null } : { status: "ACTIVE", suspendedAt: null, suspendedReason: null } });
    await audit(tx, { actorId: actor.id, action: suspend ? "user.suspended" : "user.unsuspended", entity: "user", entityId: u.id, before: { status: u.status }, after: { status: suspend ? "SUSPENDED" : "ACTIVE" }, ip: actor.ip });
  });
  if (suspend) await revokeAllSessions(u.id, "suspended");
  return { status: suspend ? "SUSPENDED" : "ACTIVE" };
}
