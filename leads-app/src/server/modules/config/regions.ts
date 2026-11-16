import "server-only";
import { prisma } from "@/server/db";

export type RegionOption = { name: string; slug: string };

/** Active cities from the config table (admin turns them on; never hardcoded). */
export function activeRegions(): Promise<RegionOption[]> {
  return prisma.region.findMany({ where: { active: true }, select: { name: true, slug: true }, orderBy: { name: "asc" } });
}
