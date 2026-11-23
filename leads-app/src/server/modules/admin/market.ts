import "server-only";
import { Prisma } from "@prisma/client";
import { BUYER_ACTIVE_DAYS, buyersPerHome, changeRatio, demandLevel, MARLA_SQFT, MARKET_TYPES, SIZE_BANDS, TREND_PERIODS, type MarketType, type SizeBand, type TrendPeriod } from "@/lib/admin/market";
import { fillGaps, median, trendBuckets } from "@/lib/admin/trend";
import { prisma } from "@/server/db";

/**
 * Market intelligence (admin). Prices are medians of active portal sale listings. Buyers looking:
 * people active in the last 30 days who picked the area on their buyer profile (and can afford a
 * typical home there) or answered a campaign for this type of home in the area. History comes
 * from the daily intel.area_price_snapshots.
 */

export type MarketFilter = { regionId: string; type: MarketType; size: SizeBand };

const typeOf = (t: MarketType) => MARKET_TYPES.find((x) => x.value === t) ?? MARKET_TYPES[0];
const bandOf = (s: SizeBand) => SIZE_BANDS.find((x) => x.value === s) ?? SIZE_BANDS[1];

type AreaRow = { id: string; name: string; slug: string; homes: number; per_marla: number | null; buyers: number; latest: number | null; year_ago: number | null };

export type HotArea = {
  id: string;
  name: string;
  slug: string;
  homes: number;
  buyers: number;
  buyersPerHome: number;
  level: ReturnType<typeof demandLevel>;
  /** PKR per marla (median). */
  perMarla: number | null;
  change12m: number | null;
};

export async function hotAreas({ regionId, type, size }: MarketFilter): Promise<HotArea[]> {
  const t = typeOf(type);
  const b = bandOf(size);
  const rows = await prisma.$queryRaw<AreaRow[]>(Prisma.sql`
    WITH area AS (
      SELECT id, name, slug FROM config.localities WHERE region_id = ${regionId}::uuid AND active AND archived_at IS NULL
    ), sale AS (
      SELECT locality_id, count(*)::int AS homes,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY price_pkr / (size_sqft / ${MARLA_SQFT})) AS per_marla
      FROM master.listings
      WHERE status = 'active' AND purpose = 'sale' AND archived_at IS NULL AND category = ${t.portal}
        AND size_sqft / ${MARLA_SQFT} >= ${b.min} AND size_sqft / ${MARLA_SQFT} <= ${b.max}
        AND locality_id IN (SELECT id FROM area)
      GROUP BY locality_id
    ), latest AS (
      SELECT DISTINCT ON (locality_id) locality_id, median_per_marla AS v FROM intel.area_price_snapshots
      WHERE category = ${t.category} AND size_band = ${b.value} ORDER BY locality_id, day DESC
    ), year_ago AS (
      SELECT DISTINCT ON (locality_id) locality_id, median_per_marla AS v FROM intel.area_price_snapshots
      WHERE category = ${t.category} AND size_band = ${b.value} AND day <= current_date - 365 ORDER BY locality_id, day DESC
    ), price AS (
      SELECT a.id, COALESCE(s.per_marla, l.v::float8) AS per_marla FROM area a
      LEFT JOIN sale s ON s.locality_id = a.id LEFT JOIN latest l ON l.locality_id = a.id
    ), want AS (
      -- buyers who signed up and picked the area, with a budget that reaches a typical home there
      SELECT p.id AS loc, COALESCE(bp.contact_id, bp.user_id) AS buyer
      FROM app.buyer_profiles bp JOIN app.users u ON u.id = bp.user_id
      JOIN price p ON p.id::text = ANY(bp.preferred_areas)
      WHERE u.status = 'ACTIVE' AND COALESCE(u.last_login_at, u.created_at) > now() - make_interval(days => ${BUYER_ACTIVE_DAYS})
        AND (bp.budget_max_pkr IS NULL OR p.per_marla IS NULL OR bp.budget_max_pkr >= p.per_marla * ${Number(b.value)})
      UNION
      -- people who answered a campaign for a home of this type in the area
      SELECT l.locality_id, t.contact_id
      FROM app.campaign_targets t JOIN app.campaigns c ON c.id = t.campaign_id JOIN app.listings l ON l.id = c.listing_id
      JOIN app.contacts ct ON ct.id = t.contact_id
      WHERE t.status IN ('REPLIED', 'INTERESTED', 'FORM_SENT', 'FORM_SUBMITTED', 'CONVERTED')
        AND t.updated_at > now() - make_interval(days => ${BUYER_ACTIVE_DAYS})
        AND NOT ct.dnc AND ct.archived_at IS NULL
        AND l.category = ${t.category} AND l.locality_id IN (SELECT id FROM area)
    ), buyers AS (
      SELECT loc, count(DISTINCT buyer)::int AS buyers FROM want GROUP BY loc
    )
    SELECT a.id, a.name, a.slug, COALESCE(s.homes, 0) AS homes, p.per_marla, COALESCE(w.buyers, 0) AS buyers,
           l.v::float8 AS latest, y.v::float8 AS year_ago
    FROM area a
    JOIN price p ON p.id = a.id
    LEFT JOIN sale s ON s.locality_id = a.id
    LEFT JOIN buyers w ON w.loc = a.id
    LEFT JOIN latest l ON l.locality_id = a.id
    LEFT JOIN year_ago y ON y.locality_id = a.id
    WHERE COALESCE(s.homes, 0) > 0 OR l.v IS NOT NULL`);
  return rows
    .map((r) => {
      const bph = buyersPerHome(r.buyers, r.homes);
      return { id: r.id, name: r.name, slug: r.slug, homes: r.homes, buyers: r.buyers, buyersPerHome: bph, level: demandLevel(bph), perMarla: r.per_marla, change12m: changeRatio(r.year_ago, r.latest) };
    })
    .sort((a, b) => b.buyersPerHome - a.buyersPerHome || b.homes - a.homes || a.name.localeCompare(b.name));
}

/** Median price per marla across the city's areas. */
export const cityMedian = (areas: HotArea[]) => median(areas.map((a) => a.perMarla));

type BucketRow = { locality_id: string; bucket: string; v: number };

export type PriceTrends = {
  labels: string[];
  series: { id: string; name: string; slug: string; values: (number | null)[] }[];
  median: (number | null)[];
};

/** Bucketed history for the picked areas plus the city median line, oldest bucket first. */
export async function priceTrends(f: MarketFilter & { period: TrendPeriod; areaIds: string[]; today: string }): Promise<PriceTrends> {
  const t = typeOf(f.type);
  const b = bandOf(f.size);
  const p = TREND_PERIODS.find((x) => x.value === f.period) ?? TREND_PERIODS[2];
  const buckets = trendBuckets(p.value, p.points, f.today);
  // weighted by listings, so a day with two homes counts less than a day with forty
  const rows = await prisma.$queryRaw<BucketRow[]>(Prisma.sql`
    SELECT s.locality_id, to_char(date_trunc(${p.unit}, s.day), 'YYYY-MM-DD') AS bucket,
           (sum(s.median_per_marla * s.listings) / NULLIF(sum(s.listings), 0))::float8 AS v
    FROM intel.area_price_snapshots s JOIN config.localities l ON l.id = s.locality_id
    WHERE l.region_id = ${f.regionId}::uuid AND l.archived_at IS NULL
      AND s.category = ${t.category} AND s.size_band = ${b.value} AND s.day >= ${buckets[0].key}::date
    GROUP BY 1, 2`);
  const byArea = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!byArea.has(r.locality_id)) byArea.set(r.locality_id, new Map());
    byArea.get(r.locality_id)?.set(r.bucket, r.v);
  }
  const valuesFor = (id: string) => fillGaps(buckets.map((k) => byArea.get(id)?.get(k.key) ?? null));
  const names = await prisma.locality.findMany({ where: { id: { in: f.areaIds } }, select: { id: true, name: true, slug: true } });
  return {
    labels: buckets.map((k) => k.label),
    series: f.areaIds.flatMap((id) => {
      const n = names.find((x) => x.id === id);
      return n ? [{ ...n, values: valuesFor(id) }] : [];
    }),
    median: buckets.map((_, i) => median([...byArea.keys()].map((id) => valuesFor(id)[i]))),
  };
}

/** When the portals were last crawled successfully. */
export async function lastCrawlAt(): Promise<Date | null> {
  const r = await prisma.crawlRun.findFirst({ where: { status: { in: ["success", "partial"] }, finishedAt: { not: null } }, orderBy: { finishedAt: "desc" }, select: { finishedAt: true } });
  return r?.finishedAt ?? null;
}
