import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { UrlSeg } from "@/components/ui/UrlSeg";
import { AreaDrawer } from "@/features/admin/market/components/AreaDrawer";
import { AreaPicker } from "@/features/admin/market/components/AreaPicker";
import { HotAreas } from "@/features/admin/market/components/HotAreas";
import { PriceTrends } from "@/features/admin/market/components/PriceTrends";
import { getMarket } from "@/features/admin/market/queries";
import { marketParamsSchema } from "@/features/admin/market/schema";
import { firstValues } from "@/lib/admin/resource";
import { MARKET_TYPES, SIZE_BANDS, TREND_PERIODS } from "@/lib/admin/market";
import { formatLac, formatNumber, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Market intelligence" };

type SP = Promise<Record<string, string | string[] | undefined>>;
// "12 min ago", "5 h ago", "Yesterday", "11 Nov"
const updatedAgo = (iso: string) => {
  const r = formatRelative(iso);
  return /min|h$/.test(r) ? `${r} ago` : r === "now" ? "just now" : r === "Yesterday" ? "yesterday" : `on ${r}`;
};
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)"];

export default async function MarketPage({ searchParams }: { searchParams: SP }) {
  const raw = firstValues(await searchParams);
  const p = marketParamsSchema.parse(raw);
  const m = await getMarket(p);
  if (!m) return <PageHeader title="Market intelligence" sub="No active city yet. Turn one on in the config tables." />;

  const typeLabel = MARKET_TYPES.find((t) => t.value === p.type)?.label ?? "";
  const sizeLabel = SIZE_BANDS.find((s) => s.value === p.size)?.label ?? "";
  const context = `${m.region.name} · ${typeLabel} · ${sizeLabel}`;
  const homes = m.areas.reduce((a, x) => a + x.homes, 0);
  const top = m.areas[0];
  const hrefFor = (slug: string) => {
    const q = new URLSearchParams(raw);
    q.set("area", slug);
    return `/admin/market?${q.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Market intelligence"
        sub={`${context} · ${formatNumber(homes)} homes on sale${m.crawledAt ? ` · updated ${updatedAgo(m.crawledAt)}` : ""}`}
        actions={top && <Button size="sm" variant="primary" href={`/admin/properties/selection?filter=${top.slug}`}>{`Find properties in ${top.name}`}</Button>}
      />
      <div className="filters">
        <UrlSeg label="City" name="city" value={m.region.slug} options={m.cities} resets={["areas", "area"]} />
        <UrlSeg label="Type" name="type" value={p.type} options={MARKET_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        <UrlSeg label="Size" name="size" value={p.size} options={SIZE_BANDS.map((s) => ({ value: s.value, label: s.label }))} />
      </div>
      <section className="card">
        <div className="ch">
          <h2>Hot areas</h2>
          <span className="m">ranked by buyers for each home on sale</span>
        </div>
        <div className="cb">
          <HotAreas areas={m.areas} hrefFor={hrefFor} />
        </div>
        <div className="more">
          <Link className="lnk" href="/admin/properties/areas">
            See all areas
            <Icon name="arrow" size={14} strokeWidth={2.2} />
          </Link>
        </div>
      </section>
      <section className="card">
        <div className="ch">
          <h2>Price trends</h2>
          <div className="filters">
            <UrlSeg label="Show" name="mode" value={p.mode} options={[{ value: "price", label: "Price per marla" }, { value: "change", label: "Price change %" }]} />
            <UrlSeg label="Time" name="period" value={p.period} options={TREND_PERIODS.map((t) => ({ value: t.value, label: t.label }))} />
          </div>
        </div>
        <div className="cb">
          <div className="trbar">
            <AreaPicker areas={m.areas.map((a) => ({ slug: a.slug, name: a.name, sub: `${a.buyersPerHome.toFixed(1)} buyers / home · ${a.perMarla === null ? "—" : formatLac(a.perMarla)} Lac` }))} picked={m.picked} />
          </div>
          <PriceTrends
            labels={m.trends.labels}
            series={m.trends.series.map((s, i) => ({ key: s.slug, name: s.name, color: COLORS[i], values: s.values }))}
            median={m.trends.median}
            medianLabel={`${m.region.name} median`}
            mode={p.mode}
          />
        </div>
      </section>
      {m.open && <AreaDrawer area={m.open.area} context={context} cityName={m.region.name} vsMedian={m.open.vsMedian} advice={m.open.advice} months={m.open.months} />}
    </>
  );
}
