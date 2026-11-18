import Link from "next/link";
import { Bar, Chip, Icon } from "@/components/ui";
import { ListingPic } from "@/components/ui/ListingPic";
import { formatDate, formatPkr, formatRelative, formatTime } from "@/lib/format";
import { LISTING_STATUS } from "@/lib/labels";
import { telHref } from "@/lib/links";
import type { DashboardSummary, LeadStageFilter, ListingDetail } from "@/types/api";

const pct = (n: number, of: number) => (of > 0 ? Math.min(100, Math.round((n / of) * 100)) : 0);
const DAY = 86_400_000;

/** Delivered vs bought across active packages, with a "today" marker for where delivery should be. */
export function PackageHero({ s, owner, now }: { s: DashboardSummary; owner: boolean; now: Date }) {
  const { totals, activeOrders: orders } = s;
  if (!orders.length) {
    return (
      <section className="sec hero">
        <span className="k">No active package</span>
        <div className="big">
          <b>0</b>
          <span>leads on the way</span>
        </div>
        <p className="muted" style={{ margin: "14px 0 18px", fontSize: 14 }}>
          Buy a package and we start finding buyers the same day.
        </p>
        <div>
          <Link href="/packages/buy" className="btn m" style={{ display: "inline-flex" }}>
            <Icon name="zap" size={16} />
            Buy leads
          </Link>
        </div>
        <Mini s={s} />
      </section>
    );
  }
  const one = orders[0];
  const onPace = totals.delivered >= totals.expectedByToday;
  const totalDays = (o: (typeof orders)[number]) => Math.round((new Date(o.windowEndsAt).getTime() - new Date(o.windowStartsAt).getTime()) / DAY);
  const paceBy = (() => {
    if (!totals.projectedEndDate) return null;
    if (owner) return `day ${Math.max(1, Math.ceil((new Date(totals.projectedEndDate).getTime() - new Date(one.windowStartsAt).getTime()) / DAY))}`;
    return formatDate(totals.projectedEndDate, now);
  })();
  return (
    <section className="sec hero">
      <span className="k">{owner ? `${one.planName} package · ${one.listingTitle}` : `Across your ${orders.length} active package${orders.length === 1 ? "" : "s"}`}</span>
      <div className="big">
        <b>{totals.delivered}</b>
        <span>of {totals.bought} leads delivered</span>
      </div>
      <div className="track" role="img" aria-label={`${totals.delivered} of ${totals.bought} delivered; ${totals.expectedByToday} expected by today`}>
        <i style={{ width: `${pct(totals.delivered, totals.bought)}%` }} />
        <span className="mk" style={{ left: `${pct(totals.expectedByToday, totals.bought)}%` }}>
          <span>today</span>
        </span>
      </div>
      <div className="between" style={{ fontSize: 13 }}>
        <span className="muted">{onPace && paceBy ? `On pace for all ${totals.bought} by ${paceBy}` : "Behind pace. Anything we miss comes back as cashback."}</span>
        <Link href="/packages" className="lnk" style={{ fontSize: 13 }}>
          Package details
        </Link>
      </div>
      <div className="bk">
        {owner ? (
          <div className="tl">
            <div>
              <small>Started</small>
              <b>{formatDate(one.windowStartsAt, now)}</b>
            </div>
            <div style={{ textAlign: "center" }}>
              <small>Today</small>
              <b>{`Day ${one.dayOfWindow} of ${totalDays(one)}`}</b>
            </div>
            <div style={{ textAlign: "right" }}>
              <small>Ends</small>
              <b>{formatDate(one.windowEndsAt, now)}</b>
            </div>
          </div>
        ) : (
          orders.map((o) => (
            <Link key={o.id} href="/packages" className="bkr">
              <span className="bkn">
                {o.listingTitle} <small>{o.localityName}</small>
              </span>
              <span className="bkb" aria-hidden="true">
                <i style={{ width: `${pct(o.deliveredCount, o.leadCount)}%` }} />
              </span>
              <span className="mono bkv">{`${o.deliveredCount}/${o.leadCount}`}</span>
              <span className="muted bkd">{o.daysLeft} d</span>
            </Link>
          ))
        )}
      </div>
      <Mini s={s} />
    </section>
  );
}

function Mini({ s }: { s: DashboardSummary }) {
  return (
    <div className="hrow">
      <div>
        <div className="l">Today</div>
        <div className="v">
          +{s.today} <small>leads</small>
        </div>
      </div>
      <div>
        <div className="l">This week</div>
        <div className="v">
          +{s.thisWeek.total} <small>leads</small>
        </div>
      </div>
      <div>
        <div className="l">Reports under check</div>
        <div className="v">{s.reportsUnderCheck}</div>
      </div>
    </div>
  );
}

/** The yellow card: buyers who said yes and haven't been called. */
export function CallCard({ s, now }: { s: DashboardSummary; now: Date }) {
  const w = s.waiting;
  return (
    <section className="sec callc" aria-labelledby="callc-h">
      <div className="between">
        <b id="callc-h" style={{ fontSize: 15 }}>
          Waiting for your call
        </b>
        <Icon name="phone" size={18} />
      </div>
      {w.count ? (
        <>
          <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
            <span className="big">{w.count}</span>
            <span style={{ fontWeight: 600 }}>new buyer{w.count === 1 ? "" : "s"} said yes</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {w.items.map((l) => (
              <div key={l.id} className="cl">
                <Link href={`/leads/${l.id}`} className="cl-a">
                  <span className="av" aria-hidden="true">
                    {l.initials}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <b>{l.buyerName}</b>
                    <small>
                      {l.said ?? "Filled in the property form"} · {formatRelative(l.deliveredAt, now)}
                    </small>
                  </div>
                </Link>
                <a href={telHref(l.phone)} className="ph-ic" aria-label={`Call ${l.buyerName}`}>
                  <Icon name="phone" size={16} />
                </a>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ fontWeight: 600 }}>
          Nobody waiting. Nice.{" "}
          <Link href="/leads" className="lnk" style={{ color: "inherit" }}>
            Go to inbox
          </Link>
        </div>
      )}
      <div className="pushdown" />
      <Link href="/leads?stage=new" className="btn full">
        Open all leads
      </Link>
    </section>
  );
}

/** "10–16 Nov" for the week strip. */
function weekRange(days: DashboardSummary["thisWeek"]["days"], now: Date): string {
  if (!days.length) return "";
  const a = formatDate(days[0].date, now);
  const b = formatDate(days[days.length - 1].date, now);
  const [ad, am] = a.split(" ");
  const [bd, bm] = b.split(" ");
  return am === bm ? `${ad}–${bd} ${bm}` : `${a} – ${b}`;
}

export function WeekBars({ s, now }: { s: DashboardSummary; now: Date }) {
  const max = Math.max(1, ...s.thisWeek.days.map((d) => d.count));
  const todayLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", weekday: "short" }).format(now);
  return (
    <section className="sec">
      <div className="sec-h">
        <h2>Leads this week</h2>
        <span className="muted mono" style={{ fontSize: 12.5 }}>
          {weekRange(s.thisWeek.days, now)}
        </span>
      </div>
      <div className="sec-b">
        <div className="wk" role="img" aria-label={s.thisWeek.days.map((d) => `${d.label} ${d.count}`).join(", ")}>
          {s.thisWeek.days.map((d, i) => (
            <div key={d.date} className={d.label === todayLabel ? "t" : ""}>
              <b>{d.count || ""}</b>
              <i style={{ height: `${Math.max(4, pct(d.count, max))}%`, animationDelay: `${i * 60}ms` }} />
              <span>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PIPE: { key: keyof DashboardSummary["pipeline"]; label: string; stage: LeadStageFilter; color: string }[] = [
  { key: "new", label: "New", stage: "new", color: "var(--m)" },
  { key: "contacted", label: "Contacted", stage: "contacted", color: "var(--ink-3)" },
  { key: "viewing", label: "Viewing", stage: "viewing", color: "var(--m-mid)" },
  { key: "won", label: "Won", stage: "won", color: "var(--ink)" },
  { key: "lost", label: "Lost", stage: "lost", color: "var(--line-2)" },
];

export function PipelineBars({ s }: { s: DashboardSummary }) {
  const max = Math.max(1, ...PIPE.map((p) => s.pipeline[p.key]));
  return (
    <section className="sec">
      <div className="sec-h">
        <h2>Where your leads are</h2>
        <Link href="/leads" className="lnk">
          Inbox
        </Link>
      </div>
      <div className="sec-b">
        <div className="pipe2">
          {PIPE.map((p) => (
            <Link key={p.key} href={`/leads?stage=${p.stage}`} className="r" aria-label={`${p.label}: ${s.pipeline[p.key]}`}>
              <span>{p.label}</span>
              <span className="tr" aria-hidden="true">
                <i style={{ width: `${pct(s.pipeline[p.key], max)}%`, background: p.color }} />
              </span>
              <b>{s.pipeline[p.key]}</b>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FollowUps({ s }: { s: DashboardSummary }) {
  const f = s.followUpsToday;
  return (
    <section className="sec">
      <div className="sec-h">
        <h2>Follow-ups today</h2>
        <span className="muted mono" style={{ fontSize: 12.5 }}>
          {f.length}
        </span>
      </div>
      <div className="sec-b" style={{ paddingTop: 6, paddingBottom: 6 }}>
        {f.length ? (
          f.map((x) => (
            <Link key={x.leadId} href={`/leads/${x.leadId}`} className="fu">
              <span className="tm">{formatTime(x.at)}</span>
              <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{x.buyerName}</b>
                <div className="muted" style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {x.listingTitle}
                </div>
              </div>
              <span className="ty">{x.kind === "VISIT" ? "Visit" : "Call"}</span>
            </Link>
          ))
        ) : (
          <div className="empty" style={{ margin: "8px 0" }}>
            No follow-ups today.
          </div>
        )}
      </div>
    </section>
  );
}

/** Owner: the one property, with its package. */
export function PropertyCard({ l }: { l: ListingDetail }) {
  const st = LISTING_STATUS[l.status as keyof typeof LISTING_STATUS];
  const o = l.activeOrder;
  const facts = [
    [l.locality.name, l.locality.regionName].filter(Boolean).join(", "),
    ((p) => (p.startsWith("PKR") ? p : `PKR ${p}`))(formatPkr(l.pricePkr)),
    l.bedrooms ? `${l.bedrooms} bed` : null,
    l.qualityScore !== null ? `listing quality ${l.qualityScore}%` : null,
  ].filter(Boolean);
  return (
    <section className="sec">
      <div className="sec-h">
        <h2>Your property</h2>
        <Link href="/listings" className="lnk">
          Manage
        </Link>
      </div>
      <div className="prop">
        <ListingPic kind={l.category} hot={l.leadCount > 0} size={96} coverUrl={l.coverUrl} className="pbig" />
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <b style={{ fontSize: 20, letterSpacing: "-.02em" }}>{l.title}</b>
            {st && <Chip tone={st.tone}>{st.label}</Chip>}
          </div>
          <div className="muted" style={{ marginTop: 2 }}>
            {facts.join(" · ")}
          </div>
          {o && (
            <div style={{ maxWidth: 420, marginTop: 12 }}>
              <div className="between" style={{ fontSize: 13 }}>
                <span>
                  {o.planName} package · <b className="mono">{`${o.deliveredCount}/${o.leadCount}`}</b>
                </span>
                <span className="muted">{o.daysLeft} days left</span>
              </div>
              <Bar value={o.deliveredCount} max={o.leadCount} label={`${o.planName} package delivered`} className="mt6" />
            </div>
          )}
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <Link href={`/listings/${l.id}`} className="btn">
            View listing
          </Link>
          {l.status === "APPROVED" && (
            <Link href={`/packages/buy?listing=${l.id}`} className="btn m">
              Buy more leads
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

