import "server-only";
import { unstable_cache } from "next/cache";
import { areaAdvice, MAX_TREND_AREAS, type MarketType, type SizeBand, type TrendPeriod } from "@/lib/admin/market";
import { cityMedian, hotAreas, lastCrawlAt, priceTrends } from "@/server/modules/admin/market";
import { ADMIN_TAGS } from "@/server/modules/admin/refresh";
import { activeRegions } from "@/server/modules/catalog/service";
import type { MarketParams } from "./schema";

const opts = { tags: [ADMIN_TAGS.market], revalidate: 600 };
const cachedHot = unstable_cache((regionId: string, type: MarketType, size: SizeBand) => hotAreas({ regionId, type, size }), ["admin-hot-areas"], opts);
const cachedTrends = unstable_cache(
  (regionId: string, type: MarketType, size: SizeBand, period: TrendPeriod, areaIds: string[], today: string) => priceTrends({ regionId, type, size, period, areaIds, today }),
  ["admin-price-trends"],
  opts,
);

const karachiToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());

export async function getMarket(p: MarketParams) {
  const regions = await activeRegions();
  const region = regions.find((r) => r.slug === p.city) ?? regions[0] ?? null;
  if (!region) return null;
  const [areas, crawledAt] = await Promise.all([cachedHot(region.id, p.type, p.size), lastCrawlAt()]);
  const picked = (p.areas ?? []).map((s) => areas.find((a) => a.slug === s)).filter((a) => a !== undefined);
  // default: the top areas by demand
  const lines = (p.areas ? picked : areas).slice(0, MAX_TREND_AREAS);
  const trends = await cachedTrends(region.id, p.type, p.size, p.period, lines.map((a) => a.id), karachiToday());
  const median = cityMedian(areas);
  const open = p.area ? areas.find((a) => a.slug === p.area) ?? null : null;
  const months = open ? await cachedTrends(region.id, p.type, p.size, "month", [open.id], karachiToday()) : null;
  const vsMedian = open?.perMarla && median ? open.perMarla / median - 1 : null;
  return {
    region: { slug: region.slug, name: region.name },
    cities: regions.map((r) => ({ value: r.slug, label: r.name })),
    areas,
    median,
    trends,
    picked: lines.map((a) => a.slug),
    crawledAt: crawledAt?.toISOString() ?? null,
    open:
      open && months
        ? { area: open, vsMedian, advice: areaAdvice(open.level, vsMedian), months: { labels: months.labels.slice(-6), values: (months.series[0]?.values ?? []).slice(-6) } }
        : null,
  };
}

export type MarketData = NonNullable<Awaited<ReturnType<typeof getMarket>>>;
