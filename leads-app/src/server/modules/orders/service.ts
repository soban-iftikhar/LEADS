import "server-only";
import type { Order, OrderStatus as DbOrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { badInput, conflict, isUniqueViolation, notFound } from "@/server/http/errors";
import { activePlanById } from "@/server/modules/catalog/service";
import { notifyUser } from "@/server/modules/notifications/service";
import type { OrderCard, OrderDetail, PaymentMethod, PayResult } from "@/types/api";
import { paymentProvider } from "./payments";

/**
 * Lead packages (DR-11). An order is a snapshot of a plan for one listing. It becomes ACTIVE when
 * its payment is confirmed; the 60-day window then starts, or starts when the listing's current
 * package ends, so two packages on one listing run one after the other.
 */

const DAY = 86_400_000;
const PAST: DbOrderStatus[] = ["COMPLETED", "EXPIRED", "CANCELLED"];

const cardInclude = {
  packagePlan: { select: { name: true } },
  listing: { select: { id: true, title: true, category: true, locality: { select: { name: true } } } },
  cashback: true,
} satisfies Prisma.OrderInclude;
type CardRow = Prisma.OrderGetPayload<{ include: typeof cardInclude }>;

const daysLeft = (end: Date) => Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY));

function toCard(o: CardRow): OrderCard {
  return {
    id: o.id,
    status: o.status,
    planName: o.packagePlan.name,
    leadCount: o.leadCount,
    deliveredCount: o.deliveredCount,
    pricePkr: o.pricePkr.toString(),
    pricePerLeadPkr: o.pricePerLeadPkr.toString(),
    windowStartsAt: o.windowStartsAt?.toISOString() ?? null,
    windowEndsAt: o.windowEndsAt?.toISOString() ?? null,
    daysLeft: o.status === "ACTIVE" && o.windowEndsAt ? daysLeft(o.windowEndsAt) : null,
    listing: { id: o.listing.id, title: o.listing.title, localityName: o.listing.locality?.name ?? "", category: o.listing.category },
    cashback: o.cashback ? { status: o.cashback.status, undeliveredCount: o.cashback.undeliveredCount, amountPkr: o.cashback.amountPkr.toString(), paidAt: o.cashback.paidAt?.toISOString() ?? null } : null,
  };
}

export async function listOrders(customerId: string, scope: "active" | "past") {
  const [rows, cashbackPaid] = await Promise.all([
    prisma.order.findMany({
      where: { customerId, status: scope === "active" ? "ACTIVE" : { in: PAST } },
      include: cardInclude,
      orderBy: scope === "active" ? { windowStartsAt: "asc" } : { createdAt: "desc" },
    }),
    prisma.cashback.aggregate({ where: { status: "PAID", order: { customerId } }, _sum: { undeliveredCount: true } }),
  ]);
  const active = scope === "active" ? rows : await prisma.order.findMany({ where: { customerId, status: "ACTIVE" }, select: { leadCount: true, deliveredCount: true } });
  return {
    items: rows.map(toCard),
    totals: {
      activeOrders: active.length,
      delivered: active.reduce((s, o) => s + o.deliveredCount, 0),
      bought: active.reduce((s, o) => s + o.leadCount, 0),
      cashbackPaidLeads: cashbackPaid._sum.undeliveredCount ?? 0,
    },
  };
}

export const hasActivePackage = async (customerId: string) => (await prisma.order.count({ where: { customerId, status: "ACTIVE" } })) > 0;

export async function createOrder(customerId: string, listingId: string, planId: string): Promise<{ orderId: string }> {
  const [listing, plan] = await Promise.all([prisma.listing.findFirst({ where: { id: listingId, customerId, status: { not: "ARCHIVED" } }, select: { id: true, status: true } }), activePlanById(planId)]);
  if (!listing) throw notFound("We couldn't find that listing.");
  if (listing.status !== "APPROVED") throw conflict("Only live listings can get a package.");
  if (!plan) throw badInput({ packagePlanId: "Pick a package." }, "Pick a package.");
  try {
    const o = await prisma.order.create({
      data: { customerId, listingId: listing.id, packagePlanId: plan.id, leadCount: plan.leadCount, pricePkr: plan.pricePkr, pricePerLeadPkr: plan.pricePkr / BigInt(plan.leadCount) },
      select: { id: true },
    });
    return { orderId: o.id };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // one order per listing may wait for payment (orders_one_pending_per_listing)
    const pending = await prisma.order.findFirst({ where: { listingId: listing.id, status: "PENDING_PAYMENT" }, select: { id: true } });
    throw conflict("This listing already has an order waiting for payment.", pending ? { orderId: pending.id } : null);
  }
}

export async function getOrder(customerId: string, id: string): Promise<OrderDetail> {
  const o = await prisma.order.findFirst({ where: { id, customerId }, include: { ...cardInclude, payments: { orderBy: { createdAt: "asc" } } } });
  if (!o) throw notFound("We couldn't find that order.");
  return {
    ...toCard(o),
    payments: o.payments.map((p) => ({ status: p.status, provider: p.provider, createdAt: p.createdAt.toISOString() })),
    startsAt: (o.windowStartsAt ?? (await queueStart(prisma, o.listingId, o.id))).toISOString(),
    methods: [...paymentProvider().methods],
  };
}

export async function payOrder(customerId: string, id: string, method: PaymentMethod): Promise<PayResult> {
  const provider = paymentProvider();
  const { result, confirmNow } = await prisma.$transaction(async (tx) => {
    const o = await tx.order.findFirst({ where: { id, customerId } });
    if (!o) throw notFound("We couldn't find that order.");
    if (o.status !== "PENDING_PAYMENT") throw conflict("This order isn't waiting for payment.");
    return provider.start(tx, o, method);
  });
  if (confirmNow) await confirmPayment(confirmNow);
  return result;
}

/** When a new package on this listing would start: after the one running now, or now. */
async function queueStart(db: Prisma.TransactionClient, listingId: string, exceptOrderId: string): Promise<Date> {
  const running = await db.order.findFirst({ where: { listingId, status: "ACTIVE", id: { not: exceptOrderId } }, orderBy: { windowEndsAt: "desc" }, select: { windowEndsAt: true } });
  const now = new Date();
  return running?.windowEndsAt && running.windowEndsAt > now ? running.windowEndsAt : now;
}

/**
 * The money is in: the payment succeeds and its order starts (admin bank-transfer match, or a
 * gateway callback). Idempotent: confirming an already-confirmed payment changes nothing.
 */
export async function confirmPayment(paymentId: string): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: { include: { packagePlan: true } } } });
    if (!p) throw notFound("We couldn't find that payment.");
    if (p.status === "SUCCEEDED") return p.order;
    if (p.status !== "PENDING" || p.order.status !== "PENDING_PAYMENT") throw conflict("This payment can't be confirmed.");
    await tx.payment.update({ where: { id: p.id }, data: { status: "SUCCEEDED" } });
    const start = await queueStart(tx, p.order.listingId, p.order.id);
    const end = new Date(start.getTime() + p.order.packagePlan.deliveryDays * DAY);
    const order = await tx.order.update({ where: { id: p.order.id }, data: { status: "ACTIVE", windowStartsAt: start, windowEndsAt: end } });
    // the campaign agent (Python) finds buyers for it; web and workers talk only through this table
    await tx.jobRequest.create({ data: { type: "CAMPAIGN_START", payload: { orderId: order.id }, runAfter: start, dedupeKey: `campaign-start:${order.id}` } });
    await notifyUser(tx, order.customerId, "ORDER_STARTED", {
      orderId: order.id,
      planName: p.order.packagePlan.name,
      leadCount: order.leadCount,
      deliveryDays: p.order.packagePlan.deliveryDays,
      windowEndsAt: end.toISOString(),
    });
    return order;
  });
}
