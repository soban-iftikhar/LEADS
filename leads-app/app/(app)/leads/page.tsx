import type { Metadata } from "next";
import Link from "next/link";
import { LeadsTable } from "@/components/app/LeadsTable";
import { LeadsToolbar } from "@/components/app/LeadsToolbar";
import { PageHeader } from "@/components/app/PageHeader";
import { Button, Empty, Section } from "@/components/ui";
import { leadsExportHref } from "@/lib/api";
import { isUuid } from "@/lib/ids";
import { listLeads } from "@/server/modules/leads/service";
import { listMyListings } from "@/server/modules/listings/service";
import { listOrders } from "@/server/modules/orders/service";
import { requireCustomer } from "@/server/pages";
import type { LeadStageFilter } from "@/types/api";

export const metadata: Metadata = { title: "Leads", robots: { index: false } };

const STAGES: LeadStageFilter[] = ["new", "contacted", "viewing", "won", "lost", "reported"];
const PAGE_SIZE = 20;

type SP = Promise<{ stage?: string; listing?: string; q?: string; page?: string }>;

export default async function LeadsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { me, owner } = await requireCustomer("/leads");
  const q = {
    stage: STAGES.includes(sp.stage as LeadStageFilter) ? (sp.stage as LeadStageFilter) : undefined,
    listing: isUuid(sp.listing) ? sp.listing : undefined,
    q: sp.q?.trim() || undefined,
    page: Math.max(1, Number(sp.page) || 1),
    pageSize: PAGE_SIZE,
  };
  const [leads, listings, active] = await Promise.all([listLeads(me.user.id, q), listMyListings(owner, { page: 1, pageSize: 100 }), listOrders(me.user.id, "active")]);
  const agency = me.customer.kind === "AGENCY";
  const n = active.items.length;
  const sub = agency
    ? `${leads.counts.all} delivered${n ? ` across ${n} package${n === 1 ? "" : "s"}` : ""}`
    : `${leads.counts.all} delivered${active.items[0] ? ` · ${active.items[0].planName} package` : ""}`;
  const filtered = !!(q.stage || q.listing || q.q);
  const from = leads.total ? (leads.page - 1) * leads.pageSize + 1 : 0;
  const to = Math.min(leads.total, leads.page * leads.pageSize);
  const pageHref = (p: number) => {
    const u = new URLSearchParams();
    if (q.stage) u.set("stage", q.stage);
    if (q.listing) u.set("listing", q.listing);
    if (q.q) u.set("q", q.q);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/leads${s ? `?${s}` : ""}`;
  };
  const listingOptions = listings.items.filter((l) => l.leadCount > 0 || l.id === q.listing).map((l) => ({ id: l.id, label: `${l.title} · ${l.locality.name}` }));
  return (
    <>
      <PageHeader title="Leads" sub={sub} actions={<Button href={leadsExportHref(q)} download icon="upload">Export CSV</Button>} />
      <LeadsToolbar counts={leads.counts} stage={q.stage ?? "all"} listing={q.listing ?? ""} q={q.q ?? ""} listings={agency ? listingOptions : null} />
      <Section flush>
        {leads.items.length ? (
          <>
            <LeadsTable rows={leads.items} displayName={me.customer.displayName} withStatus withListing={agency} now={new Date().toISOString()} />
            <div className="pg">
              <span>{`Showing ${from}–${to} of ${leads.total}`}</span>
              <div className="row">
                {leads.page > 1 ? <Link href={pageHref(leads.page - 1)} className="btn sm">Previous</Link> : <span className="btn sm" aria-disabled="true" data-disabled="">Previous</span>}
                {to < leads.total ? <Link href={pageHref(leads.page + 1)} className="btn sm">Next</Link> : <span className="btn sm" aria-disabled="true" data-disabled="">Next</span>}
              </div>
            </div>
          </>
        ) : (
          <div className="sec-b">
            {filtered ? (
              <Empty>
                No leads match. <Link href="/leads" className="lnk">Clear filters</Link>
              </Empty>
            ) : (
              <Empty>No leads yet. They show up here once your package starts.</Empty>
            )}
          </div>
        )}
      </Section>
    </>
  );
}
