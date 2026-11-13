import type { Metadata } from "next";
import Link from "next/link";
import { LeadsTable } from "@/components/app/LeadsTable";
import { OverviewListings } from "@/components/app/OverviewListings";
import { PageHeader } from "@/components/app/PageHeader";
import { LoadError } from "@/components/app/LoadError";
import { Button, Empty, Section, StatStrip } from "@/components/ui";
import { getDashboardSummary, getLeads, getMe, getMyListings } from "@/lib/api";
import { firstName, formatDate, formatLongDay, formatRelative } from "@/lib/format";
import type { ListingCard, Me } from "@/types/api";

export const metadata: Metadata = { title: "Overview", robots: { index: false } };

function relHours(iso: string, now: Date): string {
  const r = formatRelative(iso, now);
  if (r.endsWith(" h")) return `${r.replace(" h", "")} hours ago`;
  if (r.endsWith(" min")) return `${r} ago`;
  return r === "Yesterday" ? "yesterday" : `on ${r}`;
}

function Step({ n, title, text, state, action }: { n: number; title: string; text: string; state: "done" | "now" | "wait"; action?: React.ReactNode }) {
  return (
    <div className="lrow" style={{ padding: "18px 20px" }}>
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
      <section className="sec" aria-label="Getting started">
        <Step n={1} title="Add your property" text="About 10 minutes. Photos, price and the ownership document." state={s1} action={<Button href="/listings/new" variant="primary" size="sm">Add listing</Button>} />
        <Step n={2} title="We check it" text="Our team reviews it within 24 hours." state={s2} action={<span className="muted" style={{ fontSize: 13 }}>Within 24 h</span>} />
        <Step n={3} title="Buy a lead package" text="Pick how many buyers you want. Cashback for any we miss." state={s3} action={<Button href="/packages/buy" variant="primary" size="sm">Buy leads</Button>} />
      </section>
      <div className="twocol">
        <div>
          <Section title="New leads">
            <Empty>No leads yet. They show up here once your package starts.</Empty>
          </Section>
        </div>
        <div>
          <Section title="Listings">
            <Empty action={<Button href="/listings/new" size="sm" icon="plus">Add listing</Button>}>You haven&apos;t added a property yet.</Empty>
          </Section>
        </div>
      </div>
    </>
  );
}

export default async function DashboardPage() {
  const me = await getMe();
  const now = new Date();
  if (me.counts.listings === 0) {
    return <Welcome me={me} listings={[]} />;
  }
  let data;
  try {
    const [summary, leads, listings] = await Promise.all([getDashboardSummary(), getLeads({ stage: "new", pageSize: 5 }), getMyListings({ pageSize: 50 })]);
    data = { summary, leads, listings };
  } catch {
    return (
      <>
        <PageHeader title="Overview" sub={formatLongDay(now)} />
        <LoadError />
      </>
    );
  }
  const { summary, leads, listings } = data;
  return (
    <>
      <PageHeader title="Overview" sub={formatLongDay(now)} actions={<Button href="/packages/buy" variant="primary">Buy leads</Button>} />
      <StatStrip
        items={[
          { label: "Active packages", value: summary.activeOrders, sub: <Link href="/packages" className="lnk" style={{ fontSize: 13 }}>See packages</Link> },
          { label: "Leads delivered", value: summary.delivered, unit: `/ ${summary.bought}`, bar: { value: summary.delivered, max: Math.max(1, summary.bought) } },
          summary.nextEnding
            ? { label: "Next package ends", value: formatDate(summary.nextEnding.windowEndsAt, now), sub: `in ${summary.nextEnding.daysLeft} days · ${summary.nextEnding.listingTitle}` }
            : { label: "Next package ends", value: "—", sub: "No active package" },
          { label: "Leads to call", value: summary.leadsToCall, sub: summary.oldestNewLeadAt ? `Oldest ${relHours(summary.oldestNewLeadAt, now)}` : "All caught up" },
        ]}
      />
      <Section title="New leads" action={<Link href="/leads?stage=new" className="lnk">All leads</Link>} flush>
        {leads.items.length ? (
          <LeadsTable rows={leads.items} displayName={me.customer.displayName} now={now.toISOString()} />
        ) : (
          <div className="sec-b">
            <Empty>No new leads. You&apos;re all caught up.</Empty>
          </div>
        )}
      </Section>
      <Section title="Listings" action={<Link href="/listings" className="lnk">Manage</Link>} flush>
        <OverviewListings items={listings.items} />
      </Section>
    </>
  );
}
