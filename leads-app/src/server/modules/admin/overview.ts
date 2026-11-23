import "server-only";
import type { LeadSource, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { notArchived } from "@/server/db/soft-delete";
import { setting } from "@/server/modules/settings/service";
import { adminBadges } from "./badges";
import { portalHealth } from "./crawlers";
import { buckets, currentBucket, daysIn, periodBounds, startOfToday, type Range } from "./periods";

// an order is "behind" when its share of delivered leads trails its share of elapsed days by this much
const BEHIND_MARGIN = 0.15;
// a worker that hasn't checked in for this long is a system problem
const HEARTBEAT_STALE_MS = 5 * 60_000;

export type OverviewInput = { regionId: string | null; range: Range; now?: Date };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export async function overview({ regionId, range, now = new Date() }: OverviewInput) {
  const city = regionId ? { regionId } : {};
  const period = periodBounds(range, now);
  const leadIn = (start: Date, end: Date): Prisma.LeadWhereInput => ({ ...notArchived(), deliveredAt: { gte: start, lt: end }, listing: city });

  const bs = buckets(range, now);
  const [perDay, counts, sources, revenue, prevRevenue, needs, more, portals] = await Promise.all([
    setting("admin.daily_lead_target"),
    Promise.all(bs.map((b) => prisma.lead.count({ where: leadIn(b.start, b.end) }))),
    prisma.lead.groupBy({ by: ["source"], where: leadIn(period.start, period.end), _count: { _all: true } }),
    paid(regionId, period.start, period.end),
    paid(regionId, period.prevStart, period.prevEnd),
    needsYou(regionId, now),
    moreNumbers(regionId, now),
    portalHealth(),
  ]);
  const customers = await customerCounts(regionId, period.start);

  const now_ = currentBucket(bs, now);
  const bars = bs.map((b, i) => ({ label: b.label, value: counts[i], target: perDay * daysIn(b), now: i === now_ }));
  const bySource = (s: LeadSource) => sources.find((x) => x.source === s)?._count._all ?? 0;
  const running = portals.filter((p) => p.health === "running");
  const blocked = portals.filter((p) => p.health === "blocked");

  return {
    bars,
    delivered: sum(counts),
    target: sum(bars.map((b) => b.target)),
    revenue,
    revenueChange: prevRevenue > 0 ? (revenue - prevRevenue) / prevRevenue : null,
    customers,
    crawlers: { running: running.length, total: portals.length, blocked: blocked.map((p) => p.name) },
    sources: [
      { key: "CAMPAIGN_REPLY", label: "Campaign reply", value: bySource("CAMPAIGN_REPLY") },
      { key: "CAMPAIGN_FORM", label: "Property form", value: bySource("CAMPAIGN_FORM") },
      { key: "BUYER_INQUIRY", label: "Buyer enquiry", value: bySource("BUYER_INQUIRY") },
    ],
    needs: { ...needs, problems: blocked.map((p) => `${p.name} blocked`).concat(needs.problems) },
    more,
  };
}

async function paid(regionId: string | null, start: Date, end: Date): Promise<number> {
  const r = await prisma.payment.aggregate({
    where: { ...notArchived(), status: "SUCCEEDED", createdAt: { gte: start, lt: end }, ...(regionId ? { order: { listing: { regionId } } } : {}) },
    _sum: { amountPkr: true },
  });
  return Number(r._sum.amountPkr ?? 0);
}

const customerWhere = (regionId: string | null): Prisma.UserWhereInput => ({
  role: { in: ["CUSTOMER_SELLER", "CUSTOMER_AGENCY"] },
  status: { not: "DELETED" },
  ...(regionId ? { customer: { regionId } } : {}),
});

async function customerCounts(regionId: string | null, since: Date) {
  const [active, joined] = await Promise.all([
    prisma.user.count({ where: { ...customerWhere(regionId), status: "ACTIVE" } }),
    prisma.user.count({ where: { ...customerWhere(regionId), createdAt: { gte: since } } }),
  ]);
  return { active, joined };
}

async function needsYou(regionId: string | null, now: Date) {
  const [badges, active, beats] = await Promise.all([
    adminBadges(),
    prisma.order.findMany({
      where: { ...notArchived(), status: "ACTIVE", windowStartsAt: { not: null }, windowEndsAt: { not: null }, ...(regionId ? { listing: { regionId } } : {}) },
      select: { leadCount: true, deliveredCount: true, windowStartsAt: true, windowEndsAt: true, customer: { select: { customer: { select: { displayName: true } } } } },
    }),
    prisma.heartbeat.findMany({ select: { service: true, beatAt: true } }),
  ]);
  const behind = active.filter((o) => {
    const span = (o.windowEndsAt as Date).getTime() - (o.windowStartsAt as Date).getTime();
    const elapsed = span > 0 ? Math.min(1, (now.getTime() - (o.windowStartsAt as Date).getTime()) / span) : 1;
    return o.deliveredCount / Math.max(1, o.leadCount) < elapsed - BEHIND_MARGIN;
  });
  const stale = beats.filter((b) => now.getTime() - b.beatAt.getTime() > HEARTBEAT_STALE_MS).map((b) => `${b.service} not reporting`);
  return {
    replies: badges.replies,
    review: badges.review,
    reports: badges.reports,
    behind: behind.length,
    behindNames: behind.map((o) => o.customer.customer?.displayName?.split(" ")[0] ?? "a customer").slice(0, 3),
    problems: stale,
  };
}

async function moreNumbers(regionId: string | null, now: Date) {
  const city = regionId ? { regionId } : {};
  const where = customerWhere(regionId);
  const [customers, agencies, owners, suspended, live, waiting, found, contacts, campaigns, today] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, role: "CUSTOMER_AGENCY" } }),
    prisma.user.count({ where: { ...where, role: "CUSTOMER_SELLER" } }),
    prisma.user.count({ where: { ...where, status: "SUSPENDED" } }),
    prisma.listing.count({ where: { ...notArchived(), ...city, status: "APPROVED" } }),
    prisma.listing.count({ where: { ...notArchived(), ...city, status: "UNDER_REVIEW" } }),
    prisma.masterListing.count({ where: { ...notArchived(), ...city, status: "active" } }),
    prisma.contact.count({ where: notArchived() }),
    prisma.campaign.count({ where: { ...notArchived(), status: "RUNNING", listing: city } }),
    prisma.masterListing.count({ where: { ...city, scrapedAt: { gte: startOfToday(now) } } }),
  ]);
  return { customers, agencies, owners, suspended, live, waiting, found, contacts, campaigns, today };
}

export type Overview = Awaited<ReturnType<typeof overview>>;
