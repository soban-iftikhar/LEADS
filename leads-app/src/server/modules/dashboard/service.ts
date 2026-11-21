import "server-only";
import { prisma } from "@/server/db";
import { leadItems } from "@/server/modules/leads/service";
import type { DashboardActiveOrder, DashboardSummary, FollowUpKind } from "@/types/api";

const DAY = 86_400_000;
const KARACHI_OFFSET = 5 * 3_600_000; // Asia/Karachi is UTC+5 all year (no DST)
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** UTC instant of 00:00 in Karachi on the day containing `t`, and that day's weekday (Mon = 0). */
function karachiDay(t: number): { midnight: number; weekday: number } {
  const local = new Date(t + KARACHI_OFFSET);
  return { midnight: Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - KARACHI_OFFSET, weekday: (local.getUTCDay() + 6) % 7 };
}

/** Everything the overview page shows, for one customer. */
export async function dashboardSummary(customerId: string): Promise<DashboardSummary> {
  const now = Date.now();
  const today = karachiDay(now);
  const monday = today.midnight - today.weekday * DAY;
  const live = { customerId, status: { not: "REPORTED" as const } };

  const [orders, weekLeads, todayCount, stages, reported, waitingCount, waitingItems, followUps] = await Promise.all([
    prisma.order.findMany({
      where: { customerId, status: "ACTIVE", windowStartsAt: { lte: new Date(now) } },
      include: { packagePlan: { select: { name: true, deliveryDays: true } }, listing: { select: { id: true, title: true, locality: { select: { name: true } } } } },
      orderBy: { windowStartsAt: "asc" },
    }),
    prisma.lead.findMany({ where: { customerId, deliveredAt: { gte: new Date(monday) } }, select: { deliveredAt: true } }),
    prisma.lead.count({ where: { customerId, deliveredAt: { gte: new Date(today.midnight) } } }),
    prisma.lead.groupBy({ by: ["customerStage"], where: live, _count: { _all: true } }),
    prisma.lead.count({ where: { customerId, status: "REPORTED" } }),
    prisma.lead.count({ where: { ...live, customerStage: "NEW" } }),
    leadItems({ ...live, customerStage: "NEW" }, { deliveredAt: "asc" }, 3),
    prisma.lead.findMany({
      where: { customerId, followUpAt: { gte: new Date(today.midnight), lt: new Date(today.midnight + DAY) } },
      orderBy: { followUpAt: "asc" },
      select: { id: true, buyerName: true, followUpAt: true, followUpKind: true, customerStage: true, contact: { select: { name: true } }, listing: { select: { title: true, locality: { select: { name: true } } } } },
    }),
  ]);

  const activeOrders: DashboardActiveOrder[] = orders.flatMap((o) => {
    if (!o.windowStartsAt || !o.windowEndsAt) return [];
    const days = o.packagePlan.deliveryDays;
    const dayOfWindow = Math.min(days, Math.max(1, Math.floor((now - o.windowStartsAt.getTime()) / DAY) + 1));
    return [{
      id: o.id,
      listingId: o.listing.id,
      listingTitle: o.listing.title,
      localityName: o.listing.locality?.name ?? "",
      planName: o.packagePlan.name,
      leadCount: o.leadCount,
      deliveredCount: o.deliveredCount,
      windowStartsAt: o.windowStartsAt.toISOString(),
      windowEndsAt: o.windowEndsAt.toISOString(),
      daysLeft: Math.max(0, Math.ceil((o.windowEndsAt.getTime() - now) / DAY)),
      dayOfWindow,
      expectedByToday: Math.round((o.leadCount * dayOfWindow) / days),
    }];
  });

  // projected finish: each package at its own pace so far; the latest one wins
  let projected: number | null = null;
  for (const o of activeOrders) {
    if (!o.deliveredCount) continue;
    const t = new Date(o.windowStartsAt).getTime() + ((o.leadCount / o.deliveredCount) * o.dayOfWindow - 1) * DAY;
    projected = Math.max(projected ?? 0, t);
  }

  const week = WEEKDAYS.map((label, i) => {
    const from = monday + i * DAY;
    return { date: new Date(from).toISOString(), label, count: weekLeads.filter((l) => l.deliveredAt.getTime() >= from && l.deliveredAt.getTime() < from + DAY).length };
  });
  const stage = (s: string) => stages.find((g) => g.customerStage === s)?._count._all ?? 0;

  return {
    activeOrders,
    totals: {
      delivered: activeOrders.reduce((n, o) => n + o.deliveredCount, 0),
      bought: activeOrders.reduce((n, o) => n + o.leadCount, 0),
      expectedByToday: activeOrders.reduce((n, o) => n + o.expectedByToday, 0),
      projectedEndDate: projected === null ? null : new Date(projected).toISOString(),
    },
    today: todayCount,
    thisWeek: { days: week, total: week.reduce((n, d) => n + d.count, 0) },
    pipeline: { new: stage("NEW"), contacted: stage("CONTACTED"), viewing: stage("VIEWING"), won: stage("CLOSED_WON"), lost: stage("CLOSED_LOST") },
    reportsUnderCheck: reported,
    waiting: { count: waitingCount, oldestAt: waitingItems[0]?.deliveredAt ?? null, items: waitingItems },
    followUpsToday: followUps.map((l) => ({
      leadId: l.id,
      buyerName: l.buyerName ?? l.contact.name ?? "Buyer",
      listingTitle: [l.listing.title, l.listing.locality?.name].filter(Boolean).join(" · "),
      at: (l.followUpAt as Date).toISOString(),
      // no kind picked: a lead at the viewing stage is most likely a visit
      kind: l.followUpKind ?? ((l.customerStage === "VIEWING" ? "VISIT" : "CALL") satisfies FollowUpKind),
    })),
  };
}
