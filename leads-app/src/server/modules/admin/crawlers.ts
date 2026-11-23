import "server-only";
import { prisma } from "@/server/db";
import { notArchived } from "@/server/db/soft-delete";

export type PortalHealth = "running" | "blocked" | "off";

/**
 * Each portal's state from its latest crawl: switched off in config, blocked (its last run
 * failed: Cloudflare, timeouts, layout change) or running.
 */
export async function portalHealth(): Promise<{ slug: string; name: string; health: PortalHealth; lastRunAt: Date | null }[]> {
  const portals = await prisma.portal.findMany({ where: notArchived(), orderBy: { name: "asc" }, select: { slug: true, name: true, active: true } });
  const latest = await prisma.crawlRunPortal.findMany({
    where: { platform: { in: portals.map((p) => p.slug) } },
    distinct: ["platform"],
    orderBy: [{ platform: "asc" }, { startedAt: { sort: "desc", nulls: "last" } }],
    select: { platform: true, status: true, startedAt: true },
  });
  const last = new Map(latest.map((r) => [r.platform, r]));
  return portals.map((p) => {
    const r = last.get(p.slug);
    const health: PortalHealth = !p.active ? "off" : r?.status === "failed" ? "blocked" : "running";
    return { slug: p.slug, name: p.name, health, lastRunAt: r?.startedAt ?? null };
  });
}
