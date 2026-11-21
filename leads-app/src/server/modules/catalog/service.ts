import "server-only";
import { prisma } from "@/server/db";
import type { Locality, PackagePlan, Region } from "@/types/api";

/**
 * Reference data from the config schema (no hardcoded cities): cities, areas and package plans are
 * rows an admin manages, never constants in code.
 */

export function activeRegions(): Promise<Region[]> {
  return prisma.region.findMany({ where: { active: true }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } });
}

export async function activeRegionById(id: string): Promise<Region | null> {
  return prisma.region.findFirst({ where: { id, active: true }, select: { id: true, name: true, slug: true } });
}

/** Areas of one active city, matching `q` by name or alias; at most 20. */
export async function searchLocalities(regionSlug: string, q?: string): Promise<Locality[]> {
  const term = q?.trim();
  const rows = await prisma.locality.findMany({
    where: {
      active: true,
      region: { slug: regionSlug, active: true },
      ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { aliases: { has: term.toLowerCase() } }] } : {}),
    },
    select: { id: true, name: true, slug: true, parent: { select: { name: true } } },
    orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    take: 20,
  });
  return rows.map((l) => ({ id: l.id, name: l.name, slug: l.slug, parentName: l.parent?.name ?? null }));
}

export function localityInRegion(localityId: string, regionId: string) {
  return prisma.locality.findFirst({ where: { id: localityId, regionId, active: true }, select: { id: true } });
}

/** A top-level area page (/sell/<city>/<area>), or null. */
export async function areaBySlugs(citySlug: string, areaSlug: string): Promise<{ region: string; regionSlug: string; name: string; slug: string } | null> {
  const l = await prisma.locality.findFirst({
    where: { slug: areaSlug, active: true, region: { slug: citySlug, active: true } },
    select: { name: true, slug: true, region: { select: { name: true, slug: true } } },
  });
  return l ? { region: l.region.name, regionSlug: l.region.slug, name: l.name, slug: l.slug } : null;
}

/** Every top-level area of every active city, for the sitemap and the footer. */
export async function areaPages(): Promise<{ city: string; cityName: string; area: string; name: string }[]> {
  const rows = await prisma.locality.findMany({
    where: { active: true, parentId: null, region: { active: true } },
    select: { slug: true, name: true, region: { select: { slug: true, name: true } } },
    orderBy: [{ region: { name: "asc" } }, { name: "asc" }],
  });
  return rows.map((l) => ({ city: l.region.slug, cityName: l.region.name, area: l.slug, name: l.name }));
}

export async function activePlans(): Promise<PackagePlan[]> {
  const rows = await prisma.packagePlan.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { leadCount: "asc" }] });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    leadCount: p.leadCount,
    pricePkr: p.pricePkr.toString(),
    pricePerLeadPkr: (p.pricePkr / BigInt(p.leadCount)).toString(),
    deliveryDays: p.deliveryDays,
  }));
}

export function activePlanById(id: string) {
  return prisma.packagePlan.findFirst({ where: { id, active: true } });
}
