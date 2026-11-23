import "./market.css";
import Link from "next/link";
import { cx } from "@/components/ui/cx";
import { meterBlocks } from "@/lib/admin/market";
import { formatLac, formatNumber, formatPercent } from "@/lib/format";
import type { HotArea } from "@/server/modules/admin/market";

const lac = (pkr: number | null) => (pkr === null ? "—" : formatLac(pkr));
const change = (c: number | null) => (c === null ? "—" : formatPercent(c, { signed: true }));

function Meter({ bph }: { bph: number }) {
  const on = meterBlocks(bph);
  return (
    <span className="meter" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={i < on ? "on" : undefined} />
      ))}
    </span>
  );
}

type Props = { areas: HotArea[]; hrefFor: (slug: string) => string };

/** Top three as big cards (#1 on yellow), ranks 4–8 compact. Each opens the area drawer. */
export function HotAreas({ areas, hrefFor }: Props) {
  const top = areas.slice(0, 3);
  const rest = areas.slice(3, 8);
  if (!areas.length) return <p className="muted">No homes on sale for this type and size yet. Prices appear after the next crawl.</p>;
  return (
    <>
      <div className="hot3">
        {top.map((a, i) => (
          <Link key={a.id} href={hrefFor(a.slug)} scroll={false} className={cx("hz", i === 0 && "first")} aria-label={`#${i + 1} ${a.name}, ${a.level}, ${a.buyersPerHome.toFixed(1)} buyers for each home`}>
            <span className="hz-top">
              <span className="rk">#{i + 1}</span>
              <span className={`lv ${a.level.toLowerCase()}`}>{a.level}</span>
            </span>
            <b className="nm">{a.name}</b>
            <span className="big">
              <b className="num">{a.buyersPerHome.toFixed(1)}</b>buyers for each home
            </span>
            <Meter bph={a.buyersPerHome} />
            <span className="f4">
              <span>
                <small>Price / marla</small>
                <b className="num">{lac(a.perMarla)} Lac</b>
              </span>
              <span>
                <small>Last 12 months</small>
                <b className="num">{change(a.change12m)}</b>
              </span>
              <span>
                <small>Homes on sale</small>
                <b className="num">{formatNumber(a.homes)}</b>
              </span>
              <span>
                <small>Buyers looking</small>
                <b className="num">{formatNumber(a.buyers)}</b>
              </span>
            </span>
          </Link>
        ))}
      </div>
      {rest.length > 0 && (
        <div className="hrest">
          {rest.map((a, i) => (
            <Link key={a.id} href={hrefFor(a.slug)} scroll={false} className="hm" aria-label={`#${i + 4} ${a.name}, ${a.level}`}>
              <span className="r1">
                <span>#{i + 4}</span>
                <span className={`lv ${a.level.toLowerCase()}`}>{a.level}</span>
              </span>
              <b>{a.name}</b>
              <Meter bph={a.buyersPerHome} />
              <small>
                {a.buyersPerHome.toFixed(1)} buyers / home · {lac(a.perMarla)} Lac
              </small>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
