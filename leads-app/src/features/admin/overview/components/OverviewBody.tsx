import "./overview.css";
import Link from "next/link";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { Icon } from "@/components/ui/Icon";
import { KpiRow } from "@/components/ui/Kpi";
import { formatNumber, formatPercent, formatPkr } from "@/lib/format";
import { getOverview } from "../queries";
import type { OverviewParams } from "../schema";
import { MoreNumbers } from "./MoreNumbers";
import { NeedsYou } from "./NeedsYou";

const NOTE = { week: "per day · this week", month: "per week · this month", quarter: "per month · last 3 months" } as const;

// the most common bucket target is the one drawn as the line (a short last week has a smaller one)
const typical = (xs: number[]) => xs.slice().sort((a, b) => xs.filter((x) => x === b).length - xs.filter((x) => x === a).length)[0] ?? 0;

export async function OverviewBody({ regionId, range, cityLabel }: { regionId: string | null; range: OverviewParams["range"]; cityLabel: string }) {
  const o = await getOverview(regionId, range);
  const n = o.needs;
  const onTarget = o.delivered >= o.target;
  const result = o.target ? o.delivered / o.target - 1 : 0;

  return (
    <div className="pane-sub">
      <NeedsYou
        tiles={[
          { n: n.replies, label: "Replies to check", sub: "the AI wasn't sure", href: "/admin/outreach/replies", hot: true },
          { n: n.review, label: "Listings to review", sub: "approve within 24 h", href: "/admin/listings/review" },
          { n: n.behind, label: "Packages behind", sub: n.behindNames.join(", ") || "none", href: "/admin/customers/orders" },
          { n: n.reports, label: "Lead reports", sub: "customers say a lead was wrong", href: "/admin/leads/reports" },
          { n: n.problems.length, label: "System problems", sub: n.problems.slice(0, 2).join(" · ") || "all fine", href: "/admin/crawlers/sources" },
        ]}
      />
      <KpiRow
        four
        items={[
          { label: "Leads delivered", value: formatNumber(o.delivered), delta: { text: onTarget ? "on target" : "below target", down: !onTarget }, sub: `target ${formatNumber(o.target)}`, icon: "tray", href: "/admin/leads" },
          { label: "Revenue", value: formatPkr(o.revenue), delta: o.revenueChange === null ? undefined : { text: formatPercent(o.revenueChange, { signed: true, decimals: 0 }), down: o.revenueChange < 0 }, sub: "vs previous period", icon: "cash", href: "/admin/customers/payments" },
          { label: "Active customers", value: formatNumber(o.customers.active), delta: { text: `+${o.customers.joined}` }, sub: "joined this period", icon: "people", href: "/admin/customers/accounts" },
          {
            label: "Crawler health",
            value: `${o.crawlers.running} / ${o.crawlers.total}`,
            delta: { text: o.crawlers.blocked.length ? `${o.crawlers.blocked.length} blocked` : "all fine", down: o.crawlers.blocked.length > 0 },
            sub: o.crawlers.blocked.join(", ") || "portals running",
            icon: "globe",
            href: "/admin/crawlers/sources",
          },
        ]}
      />
      <MoreNumbers
        stats={[
          { label: "Customers", value: o.more.customers, sub: "all accounts", href: "/admin/customers/accounts" },
          { label: "Agencies", value: o.more.agencies, sub: "buy for many listings", href: "/admin/customers/accounts?filter=agency" },
          { label: "Owners", value: o.more.owners, sub: "sell their own home", href: "/admin/customers/accounts?filter=owner" },
          { label: "Suspended", value: o.more.suspended, sub: "accounts on hold", href: "/admin/customers/accounts?tab=suspended" },
          { label: "Live listings", value: o.more.live, sub: "getting leads now", href: "/admin/listings?tab=live" },
          { label: "Waiting review", value: o.more.waiting, sub: "new listings", href: "/admin/listings/review" },
          { label: "Properties found", value: o.more.found, sub: "scraped from portals", href: "/admin/properties/selection" },
          { label: "Contacts", value: o.more.contacts, sub: "buyers and sellers", href: "/admin/outreach/contacts" },
          { label: "Campaigns running", value: o.more.campaigns, sub: "sending messages", href: "/admin/outreach/campaigns" },
          { label: "Records today", value: o.more.today, sub: "from crawlers", href: "/admin/crawlers/sources" },
        ]}
      />
      <div className="g2">
        <section className="card">
          <div className="ch">
            <h2>Leads delivered</h2>
            <span className="m">
              {NOTE[range]} · {cityLabel}
            </span>
          </div>
          <div className="cb">
            <div className="sumrow">
              <div>
                <small>Delivered</small>
                <b className="num">{formatNumber(o.delivered)}</b>
              </div>
              <div>
                <small>Target</small>
                <b className="num">{formatNumber(o.target)}</b>
              </div>
              <div>
                <small>Result</small>
                <b className="num" style={{ color: onTarget ? "var(--ok)" : "var(--warn)" }}>
                  {formatPercent(result, { signed: true, decimals: 0 })}
                </b>
              </div>
            </div>
            <ColumnChart
              bars={o.bars.map((b) => ({ label: b.label, value: b.value, now: b.now, title: `${b.label}: ${b.value} leads, target ${b.target}` }))}
              target={typical(o.bars.map((b) => b.target))}
              summary={`Leads delivered ${NOTE[range]}: ${o.bars.map((b) => `${b.label} ${b.value}`).join(", ")}. Target ${typical(o.bars.map((b) => b.target))} each.`}
            />
          </div>
          <div className="more">
            <Link className="lnk" href="/admin/leads">
              See all leads
              <Icon name="arrow" size={14} strokeWidth={2.2} />
            </Link>
          </div>
        </section>
        <section className="card">
          <div className="ch">
            <h2>Where leads come from</h2>
            <span className="m">{NOTE[range].split(" · ")[1]}</span>
          </div>
          <div className="cb">
            <DonutChart
              label="Lead sources"
              unit="leads"
              slices={o.sources.map((s, i) => ({ label: s.label, value: s.value, color: ["var(--m)", "var(--ink)", "var(--grey)"][i] }))}
            />
          </div>
          <div className="more">
            <Link className="lnk" href="/admin/outreach/campaigns">
              See campaigns
              <Icon name="arrow" size={14} strokeWidth={2.2} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
