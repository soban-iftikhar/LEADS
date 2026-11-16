import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { CallCard, FollowUps, PackageHero, PipelineBars, PropertyCard, WeekBars } from "@/components/app/Dashboard";
import { LoadError } from "@/components/app/LoadError";
import { OverviewListings } from "@/components/app/OverviewListings";
import { PageHeader } from "@/components/app/PageHeader";
import { PhoneNudge } from "@/components/app/PhoneNudge";
import { Button, Empty, Section } from "@/components/ui";
import { getDashboardSummary, getListing, getMe, getMyListings } from "@/lib/api";
import { firstName, formatLongDay } from "@/lib/format";
import type { ListingCard, Me } from "@/types/api";

export const metadata: Metadata = { title: "Overview", robots: { index: false } };

/** "Good morning|afternoon|evening" by the hour in Asia/Karachi. */
function greeting(now: Date): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "numeric", hour12: false }).format(now)) % 24;
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Step({ n, title, text, state, action }: { n: number; title: string; text: string; state: "done" | "now" | "wait"; action?: React.ReactNode }) {
  return (
    <div className="lrow" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--line)" }}>
      <span className={`av ${state === "now" ? "y" : state === "done" ? "k" : ""}`} style={{ width: 36, height: 36 }} aria-hidden="true">
        {state === "done" ? "✓" : n}
      </span>
      <div style={{ flex: "1 1 0%" }}>
        <b>{title}</b>
        <div className="muted" style={{ fontSize: 13 }}>
          {text}
        </div>
      </div>
      {state === "now" && action ? action : <span className="muted" style={{ fontSize: 13 }}>{state === "done" ? "Done" : "Waiting"}</span>}
    </div>
  );
}

/** First run: three steps; they tick as the first listing moves through review. */
function Welcome({ me, listings }: { me: Me; listings: ListingCard[] }) {
  const name = firstName(me.customer.contactPerson ?? me.customer.displayName);
  const reviewing = listings.some((l) => l.status === "UNDER_REVIEW" || l.status === "NEEDS_INFO");
  const live = listings.some((l) => l.status === "APPROVED");
  const s1 = listings.length ? "done" : "now";
  const s2 = live ? "done" : reviewing ? "now" : "wait";
  const s3 = live ? "now" : "wait";
  return (
    <>
      <PageHeader title={`Welcome, ${name}`} sub="Three steps to your first lead." />
      {!me.user.phoneVerified && <PhoneNudge />}
      <section className="sec" aria-label="Getting started">
        <Step n={1} title={listings.length ? "Add your property" : "Add your first property"} text="About 10 minutes. Photos, price and the ownership document." state={s1} action={<Button href="/listings/new" variant="primary" size="sm">Add listing</Button>} />
        <Step n={2} title="We check it" text="Our team reviews it within 24 hours." state={s2} action={<span className="muted" style={{ fontSize: 13 }}>Within 24 h</span>} />
        <Step n={3} title="Buy a lead package" text="Pick how many buyers you want. Cashback for any we miss." state={s3} action={<Button href="/packages/buy" variant="primary" size="sm">Buy leads</Button>} />
      </section>
      <div className="cols c-11">
        <div>
          <Section title="New leads">
            <Empty>No leads yet. They show up here once your package starts.</Empty>
          </Section>
        </div>
        <div>
          <Section title="Your listings" flush={listings.length > 0} action={listings.length ? <Link href="/listings" className="lnk">Manage</Link> : undefined}>
            {listings.length ? (
              <OverviewListings items={listings} />
            ) : (
              <Empty action={<Button href="/listings/new" size="sm" icon="plus">Add listing</Button>}>No listings yet.</Empty>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

export default async function DashboardPage() {
  const me = await getMe();
  const now = new Date();
  if (me.counts.listings === 0) return <Welcome me={me} listings={[]} />;
  const owner = me.customer.kind === "SELLER";
  const title = `${greeting(now)}, ${firstName(me.customer.contactPerson ?? me.customer.displayName)}`;
  let data;
  try {
    const [summary, listings] = await Promise.all([getDashboardSummary(), getMyListings({ pageSize: 50 })]);
    const mine = listings.items.filter((l) => l.status !== "ARCHIVED");
    // owner: one property card needs beds, so load the full listing
    const property = owner && mine[0] ? await getListing(mine[0].id) : null;
    data = { summary, listings: mine, property };
  } catch (e) {
    unstable_rethrow(e);
    return (
      <>
        <PageHeader title={title} sub={formatLongDay(now)} />
        <LoadError />
      </>
    );
  }
  const { summary, listings, property } = data;
  const leadsEver = Object.values(summary.pipeline).reduce((a, b) => a + b, 0) + summary.reportsUnderCheck;
  // until the first package is bought, the three steps are more useful than empty charts
  if (!summary.activeOrders.length && leadsEver === 0) return <Welcome me={me} listings={listings} />;
  return (
    <>
      <PageHeader title={title} sub={formatLongDay(now)} actions={<Button href="/packages/buy" variant="primary" icon="zap">Buy leads</Button>} />
      {!me.user.phoneVerified && <PhoneNudge />}
      <div className="cols c-21">
        <div>
          <PackageHero s={summary} owner={owner} now={now} />
        </div>
        <div>
          <CallCard s={summary} now={now} />
        </div>
      </div>
      <div className="cols c-111">
        <div>
          <WeekBars s={summary} now={now} />
        </div>
        <div>
          <PipelineBars s={summary} />
        </div>
        <div>
          <FollowUps s={summary} />
        </div>
      </div>
      {owner && property ? (
        <PropertyCard l={property} />
      ) : (
        <Section title="Your listings" action={<Link href="/listings" className="lnk">Manage</Link>} flush>
          <OverviewListings items={listings} />
        </Section>
      )}
    </>
  );
}
