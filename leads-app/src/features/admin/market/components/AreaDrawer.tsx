"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { formatLac, formatNumber, formatPercent } from "@/lib/format";
import type { HotArea } from "@/server/modules/admin/market";

type Props = { area: HotArea; context: string; cityName: string; vsMedian: number | null; advice: string; months: { labels: string[]; values: (number | null)[] } };

/** Six facts, six months of price, one line of advice, and a way to act on it. */
export function AreaDrawer({ area, context, cityName, vsMedian, advice, months }: Props) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const close = () => {
    const q = new URLSearchParams(sp.toString());
    q.delete("area");
    router.replace(q.size ? `${path}?${q.toString()}` : path, { scroll: false });
  };
  const pct = (v: number | null) => (v === null ? "—" : formatPercent(v, { signed: true }));
  const bars = months.labels.map((label, i) => ({ label, value: Number(formatLac(months.values[i] ?? 0)), now: i === months.labels.length - 1 }));
  return (
    <Drawer
      title={area.name}
      sub={context}
      onClose={close}
      footer={
        <>
          <Button variant="primary" full href={`/admin/properties/selection?filter=${area.slug}`}>
            Find properties here
          </Button>
          <Button onClick={close}>Close</Button>
        </>
      }
    >
      <div className="facts">
        <div>
          <small>Price / marla</small>
          <b className="num">{area.perMarla === null ? "—" : `${formatLac(area.perMarla)} Lac`}</b>
        </div>
        <div>
          <small>vs {cityName} median</small>
          <b className="num">{pct(vsMedian)}</b>
        </div>
        <div>
          <small>Buyers per home</small>
          <b className="num">{area.buyersPerHome.toFixed(1)}</b>
        </div>
        <div>
          <small>12-month change</small>
          <b className="num">{pct(area.change12m)}</b>
        </div>
        <div>
          <small>Homes on sale</small>
          <b className="num">{formatNumber(area.homes)}</b>
        </div>
        <div>
          <small>Buyers looking</small>
          <b className="num">{formatNumber(area.buyers)}</b>
        </div>
      </div>
      <div>
        <b style={{ fontSize: 14 }}>Price per marla, last 6 months</b>
        <ColumnChart bars={bars} bare height={170} format={(n) => n.toFixed(1)} summary={`${area.name} price per marla in lakh: ${bars.map((b) => `${b.label} ${b.value}`).join(", ")}`} />
      </div>
      <div className="callout">{advice}</div>
    </Drawer>
  );
}
