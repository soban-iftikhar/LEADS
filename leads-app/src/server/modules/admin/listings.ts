import "server-only";
import type { ListingStatus, Prisma } from "@prisma/client";
import { pageWindow, type ListParams, type ListResult, type PillTone, type Row } from "@/lib/admin/resource";
import { formatRelative } from "@/lib/format";
import { orderFor } from "@/lib/sort";
import { prisma } from "@/server/db";
import { archiveScope } from "@/server/db/soft-delete";
import { reviewListing } from "./service";
import type { AdminActor } from "./guard";

/** Listings customers want leads for (ADMIN_BUILD 6.4): the review queue and the full list. */

export const LISTING_PILL: Record<ListingStatus, { label: string; tone: PillTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  UNDER_REVIEW: { label: "Waiting", tone: "info" },
  NEEDS_INFO: { label: "Needs info", tone: "warn" },
  APPROVED: { label: "Live", tone: "ok" },
  REJECTED: { label: "Rejected", tone: "neutral" },
  PAUSED: { label: "Paused", tone: "warn" },
  SOLD: { label: "Sold", tone: "acc" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

const select = {
  id: true,
  title: true,
  pricePkr: true,
  status: true,
  updatedAt: true,
  archivedAt: true,
  locality: { select: { name: true } },
  region: { select: { name: true } },
  customer: { select: { email: true, customer: { select: { displayName: true } } } },
} satisfies Prisma.ListingSelect;

type ListingRow = Prisma.ListingGetPayload<{ select: typeof select }>;

const search = (q: string): Prisma.ListingWhereInput =>
  q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { locality: { name: { contains: q, mode: "insensitive" } } },
          { customer: { customer: { displayName: { contains: q, mode: "insensitive" } } } },
          { customer: { email: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};

const SORTS: Record<string, (d: Prisma.SortOrder) => Prisma.ListingOrderByWithRelationInput> = {
  property: (d) => ({ title: d }),
  customer: (d) => ({ customer: { customer: { displayName: d } } }),
  price: (d) => ({ pricePkr: d }),
  waiting: (d) => ({ updatedAt: d === "asc" ? "desc" : "asc" }),
};

const cells = (r: ListingRow) => ({
  property: { a: r.title, b: [r.locality?.name, r.region.name].filter(Boolean).join(" · ") },
  customer: r.customer.customer?.displayName ?? r.customer.email,
  price: r.pricePkr === null ? null : Number(r.pricePkr),
});

/** Review queue: waiting listings only, oldest first. */
export async function listReviewQueue(p: ListParams, take?: number): Promise<ListResult> {
  const where: Prisma.ListingWhereInput = { ...archiveScope(p.tab), status: "UNDER_REVIEW", ...search(p.q) };
  const [rows, total] = await Promise.all([
    prisma.listing.findMany({ where, orderBy: orderFor(p.sort, SORTS, { updatedAt: "asc" }, { id: "asc" }), ...pageWindow(p.page, take), select }),
    prisma.listing.count({ where }),
  ]);
  return {
    total,
    counts: {},
    rows: rows.map((r): Row => ({ id: r.id, archived: !!r.archivedAt, cells: { ...cells(r), waiting: formatRelative(r.updatedAt.toISOString()) }, action: { label: "Approve" } })),
  };
}

/** Approve: the listing goes live and the customer is told (same path as before the console). */
export async function approveListings(actor: AdminActor, ids: string[]): Promise<number> {
  let n = 0;
  for (const id of ids) {
    const l = await prisma.listing.findUnique({ where: { id }, select: { status: true, archivedAt: true } });
    if (l?.status !== "UNDER_REVIEW" || l.archivedAt) continue;
    await reviewListing(actor, id, "APPROVE", undefined);
    n++;
  }
  return n;
}

/** The status tabs of All listings, by URL value. */
const TABS: Record<string, ListingStatus[]> = {
  live: ["APPROVED"],
  waiting: ["UNDER_REVIEW"],
  info: ["NEEDS_INFO"],
  paused: ["PAUSED"],
  closed: ["SOLD", "REJECTED"],
};

const allWhere = (p: ListParams, tab = p.tab): Prisma.ListingWhereInput => ({
  ...archiveScope(tab),
  status: TABS[tab] ? { in: TABS[tab] } : { not: "DRAFT" },
  ...(p.filter !== "all" ? { category: p.filter.toUpperCase() } : {}),
  ...search(p.q),
});

export async function listAllListings(p: ListParams, take?: number): Promise<ListResult> {
  const where = allWhere(p);
  const tabs = ["all", ...Object.keys(TABS), "archived"];
  const [rows, total, ...counts] = await Promise.all([
    prisma.listing.findMany({ where, orderBy: orderFor(p.sort, SORTS, { updatedAt: "desc" }, { id: "asc" }), ...pageWindow(p.page, take), select }),
    prisma.listing.count({ where }),
    ...tabs.map((t) => prisma.listing.count({ where: allWhere(p, t) })),
  ]);
  return {
    total,
    counts: Object.fromEntries(tabs.map((t, i) => [t, counts[i]])),
    rows: rows.map((r): Row => ({ id: r.id, archived: !!r.archivedAt, cells: { ...cells(r), status: LISTING_PILL[r.status] } })),
  };
}
