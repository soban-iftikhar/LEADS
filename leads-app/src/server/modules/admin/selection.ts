import "server-only";
import type { Prisma } from "@prisma/client";
import { pageWindow, type ListParams, type ListResult, type Row } from "@/lib/admin/resource";
import { MARLA_SQFT } from "@/lib/admin/market";
import { orderFor } from "@/lib/sort";
import { prisma } from "@/server/db";
import { archiveScope, notArchived } from "@/server/db/soft-delete";
import { audit } from "@/server/modules/audit/service";
import type { AdminActor } from "./guard";

/**
 * Property selection (ADMIN_BUILD 6.3): scraped sale listings ranked for outreach to their
 * sellers. "Invite" starts prospect outreach (PRS-1): a prospect_outreach row and a job for the
 * messaging worker. A property without a known seller number can't be invited.
 */

const WEEK_MS = 7 * 86_400_000;

const base = (p: ListParams): Prisma.MasterListingWhereInput => ({
  ...archiveScope(p.tab),
  status: "active",
  purpose: "sale",
  ...(p.filter !== "all" ? { localityRef: { slug: p.filter } } : {}),
  ...(p.q ? { OR: [{ title: { contains: p.q, mode: "insensitive" } }, { locality: { contains: p.q, mode: "insensitive" } }] } : {}),
});

const byTab = (tab: string): Prisma.MasterListingWhereInput => (tab === "new" ? { prospectOutreach: null } : tab === "invited" ? { prospectOutreach: { isNot: null } } : {});

const SORTS: Record<string, (d: Prisma.SortOrder) => Prisma.MasterListingOrderByWithRelationInput> = {
  property: (d) => ({ title: d }),
  price: (d) => ({ pricePkr: d }),
  vs: (d) => ({ score: { priceDeviationPct: d } }),
  score: (d) => ({ score: { rankScore: d } }),
};

const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

export async function listSelection(p: ListParams, take?: number): Promise<ListResult> {
  const where = { ...base(p), ...byTab(p.tab) };
  const [rows, total, all, fresh, invited, archived] = await Promise.all([
    prisma.masterListing.findMany({
      where,
      orderBy: orderFor(p.sort, SORTS, { score: { rankScore: "desc" } }, { id: "asc" }),
      ...pageWindow(p.page, take),
      select: {
        id: true,
        title: true,
        platform: true,
        locality: true,
        pricePkr: true,
        sizeSqft: true,
        contactId: true,
        archivedAt: true,
        score: { select: { rankScore: true, priceDeviationPct: true } },
        prospectOutreach: { select: { status: true } },
      },
    }),
    prisma.masterListing.count({ where }),
    prisma.masterListing.count({ where: base({ ...p, tab: "all" }) }),
    prisma.masterListing.count({ where: { ...base({ ...p, tab: "all" }), ...byTab("new") } }),
    prisma.masterListing.count({ where: { ...base({ ...p, tab: "all" }), ...byTab("invited") } }),
    prisma.masterListing.count({ where: base({ ...p, tab: "archived" }) }),
  ]);
  return {
    total,
    counts: { all, new: fresh, invited, archived },
    rows: rows.map((r): Row => {
      const isNew = !r.prospectOutreach;
      const marla = Number(r.sizeSqft) / MARLA_SQFT;
      return {
        id: r.id,
        archived: !!r.archivedAt,
        cells: {
          property: { a: r.title, b: `${r.locality} · ${r.platform[0].toUpperCase()}${r.platform.slice(1)}${marla ? ` · ${marla.toFixed(0)} Marla` : ""}` },
          price: Number(r.pricePkr),
          vs: r.score?.priceDeviationPct == null ? null : pct(Number(r.score.priceDeviationPct)),
          score: r.score ? Math.round(Number(r.score.rankScore) * 100) : null,
          status: isNew ? { label: "New", tone: "info" } : { label: "Invited", tone: "ok" },
        },
        action: isNew ? { label: "Invite" } : null,
      };
    }),
  };
}

export async function selectionKpis() {
  const live = { ...notArchived(), status: "active", purpose: "sale" } satisfies Prisma.MasterListingWhereInput;
  const [toInvite, week, avg] = await Promise.all([
    prisma.masterListing.count({ where: { ...live, prospectOutreach: null } }),
    prisma.prospectOutreach.count({ where: { createdAt: { gte: new Date(Date.now() - WEEK_MS) } } }),
    prisma.listingScore.aggregate({ where: { masterListing: live }, _avg: { rankScore: true } }),
  ]);
  return { toInvite, week, avgScore: avg._avg.rankScore === null ? null : Math.round(Number(avg._avg.rankScore) * 100) };
}

/** Invite the sellers of the picked properties. Returns how many were invited and skipped. */
export async function inviteSellers(actor: AdminActor, ids: string[]): Promise<{ invited: number; noNumber: number }> {
  const picked = await prisma.masterListing.findMany({ where: { id: { in: ids }, ...notArchived(), prospectOutreach: null }, select: { id: true, contactId: true, title: true } });
  const withNumber = picked.filter((p): p is typeof p & { contactId: string } => !!p.contactId);
  await prisma.$transaction(async (tx) => {
    for (const p of withNumber) {
      const po = await tx.prospectOutreach.create({ data: { masterListingId: p.id, contactId: p.contactId, selectedById: actor.id } });
      await tx.jobRequest.create({ data: { type: "PROSPECT_START", payload: { prospectOutreachId: po.id }, requestedById: actor.id, dedupeKey: `prospect:${po.id}` } });
    }
    if (withNumber.length)
      await audit(tx, {
        actorId: actor.id,
        action: "prospect.invited",
        entity: "masterListing",
        entityId: withNumber.length === 1 ? withNumber[0].id : null,
        after: { ids: withNumber.map((p) => p.id) },
        summary: withNumber.length === 1 ? `Invited the seller of ${withNumber[0].title}` : `Invited ${withNumber.length} sellers`,
        ip: actor.ip,
      });
  });
  return { invited: withNumber.length, noNumber: picked.length - withNumber.length };
}
