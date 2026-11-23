import "server-only";
import type { Prisma } from "@prisma/client";
import { pageWindow, type ListParams, type ListResult, type Row } from "@/lib/admin/resource";
import { formatLac } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { orderFor } from "@/lib/sort";
import { prisma } from "@/server/db";
import { archiveScope } from "@/server/db/soft-delete";
import { conflict, notFound } from "@/server/http/errors";
import { audit } from "@/server/modules/audit/service";
import type { AdminActor } from "./guard";

/**
 * Areas (ADMIN_BUILD 6.3): the localities we crawl and run campaigns in (config.localities).
 * New areas are added here, never in code (CLAUDE.md rule 5). Price per marla is the latest
 * 10 Marla house snapshot; listings are active portal listings in the area.
 */

export const AREA_KINDS = { SECTOR: "Sector", SOCIETY: "Society", AREA: "Area" } as const;
export type AreaKind = keyof typeof AREA_KINDS;

const base = (p: ListParams): Prisma.LocalityWhereInput => ({
  ...archiveScope(p.tab),
  ...(p.tab === "active" ? { active: true } : p.tab === "off" ? { active: false } : {}),
  ...(p.filter !== "all" ? { kind: p.filter.toUpperCase() } : {}),
  ...(p.q ? { OR: [{ name: { contains: p.q, mode: "insensitive" } }, { region: { name: { contains: p.q, mode: "insensitive" } } }] } : {}),
});

const SORTS: Record<string, (d: Prisma.SortOrder) => Prisma.LocalityOrderByWithRelationInput> = {
  area: (d) => ({ name: d }),
  listings: (d) => ({ masterListings: { _count: d } }),
};

export async function listAreas(p: ListParams, take?: number): Promise<ListResult> {
  const where = base(p);
  const [rows, total, all, active, off, archived] = await Promise.all([
    prisma.locality.findMany({
      where,
      orderBy: orderFor(p.sort, SORTS, { name: "asc" }, { id: "asc" }),
      ...pageWindow(p.page, take),
      select: { id: true, name: true, kind: true, active: true, archivedAt: true, regionId: true, region: { select: { name: true } } },
    }),
    prisma.locality.count({ where }),
    prisma.locality.count({ where: base({ ...p, tab: "all" }) }),
    prisma.locality.count({ where: base({ ...p, tab: "active" }) }),
    prisma.locality.count({ where: base({ ...p, tab: "off" }) }),
    prisma.locality.count({ where: base({ ...p, tab: "archived" }) }),
  ]);
  const ids = rows.map((r) => r.id);
  const [counts, prices] = await Promise.all([
    prisma.masterListing.groupBy({ by: ["localityId"], where: { localityId: { in: ids }, status: "active", archivedAt: null }, _count: { _all: true } }),
    prisma.areaPriceSnapshot.findMany({ where: { localityId: { in: ids }, category: "HOUSE", sizeBand: "10" }, distinct: ["localityId"], orderBy: [{ localityId: "asc" }, { day: "desc" }], select: { localityId: true, medianPerMarla: true } }),
  ]);
  return {
    total,
    counts: { all, active, off, archived },
    rows: rows.map((r): Row => {
      const price = prices.find((x) => x.localityId === r.id)?.medianPerMarla;
      return {
        id: r.id,
        archived: !!r.archivedAt,
        cells: {
          area: { a: r.name, b: r.region.name },
          kind: { label: AREA_KINDS[r.kind as AreaKind] ?? r.kind, tone: r.kind === "SECTOR" ? "acc" : "neutral" },
          price: price ? formatLac(Number(price)) : null,
          listings: counts.find((c) => c.localityId === r.id)?._count._all ?? 0,
          status: r.active ? { label: "Active", tone: "ok" } : { label: "Off", tone: "neutral" },
        },
        values: { name: r.name, regionId: r.regionId, kind: r.kind, status: r.active ? "active" : "off" },
      };
    }),
  };
}

export type AreaInput = { id?: string; name: string; regionId: string; kind: AreaKind; status: "active" | "off" };

/** Add or edit an area. The slug follows the name and must be unique in its city. */
export async function saveArea(actor: AdminActor, input: AreaInput): Promise<{ created: boolean }> {
  const slug = slugify(input.name, "area");
  const clash = await prisma.locality.findFirst({ where: { regionId: input.regionId, slug, ...(input.id ? { id: { not: input.id } } : {}) }, select: { id: true } });
  if (clash) throw conflict("That city already has an area with this name.", { name: "That city already has an area with this name." });
  const data = { name: input.name, slug, regionId: input.regionId, kind: input.kind, active: input.status === "active" };
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const before = await tx.locality.findUnique({ where: { id: input.id }, select: { name: true, kind: true, active: true } });
      if (!before) throw notFound("We couldn't find that area.");
      await tx.locality.update({ where: { id: input.id }, data });
      await audit(tx, { actorId: actor.id, action: "area.updated", entity: "locality", entityId: input.id, before, after: data, summary: `Edited area ${input.name}`, ip: actor.ip });
      return { created: false };
    }
    const row = await tx.locality.create({ data: { ...data, aliases: [] } });
    await audit(tx, { actorId: actor.id, action: "area.created", entity: "locality", entityId: row.id, after: data, summary: `Added area ${input.name}`, ip: actor.ip });
    return { created: true };
  });
}

/** City choices for the form: config.regions. */
export async function regionOptions() {
  const rows = await prisma.region.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}
