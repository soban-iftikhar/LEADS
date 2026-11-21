import type { Metadata } from "next";
import { ListingsTable } from "@/components/app/ListingsTable";
import { PageHeader } from "@/components/app/PageHeader";
import { Button, Empty, Section, Segmented } from "@/components/ui";
import type { ListingFilter } from "@/lib/labels";
import { listMyListings } from "@/server/modules/listings/service";
import { requireCustomer } from "@/server/pages";

export const metadata: Metadata = { title: "Listings", robots: { index: false } };

const FILTERS: ListingFilter[] = ["live", "review", "info", "rejected", "draft", "paused", "sold"];

export default async function ListingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = FILTERS.includes(sp.status as ListingFilter) ? (sp.status as ListingFilter) : undefined;
  const { me, owner: viewer } = await requireCustomer("/listings");
  const { items, counts } = await listMyListings(viewer, { status, page: 1, pageSize: 100 });
  const owner = me.customer.kind === "SELLER";
  const action = counts.info + counts.rejected;
  const parts = [`${counts.live} live`, `${counts.review} under review`, `${action} need${action === 1 ? "s" : ""} action`];
  // the owner sees only what applies to their few listings ("1 live")
  const ownerParts = [counts.live && `${counts.live} live`, counts.review && `${counts.review} under review`, action && `${action} need${action === 1 ? "s" : ""} action`, counts.draft && `${counts.draft} draft`].filter(Boolean);
  const sub = owner ? ownerParts.join(" · ") || "No listings yet" : parts.join(" · ");
  const tabs = [
    { value: "all", label: "All", count: counts.all, href: "/listings" },
    { value: "live", label: "Live", count: counts.live, href: "/listings?status=live" },
    { value: "review", label: "Under review", count: counts.review, href: "/listings?status=review" },
    { value: "info", label: "Needs info", count: counts.info, href: "/listings?status=info" },
    { value: "rejected", label: "Rejected", count: counts.rejected, href: "/listings?status=rejected" },
    ...(["draft", "paused", "sold"] as const)
      .filter((k) => counts[k] > 0 || status === k)
      .map((k) => ({ value: k, label: k === "draft" ? "Draft" : k === "paused" ? "Paused" : "Sold", count: counts[k], href: `/listings?status=${k}` })),
  ];
  return (
    <>
      <PageHeader title="Listings" sub={sub} actions={<Button href="/listings/new" variant="primary" icon="plus">Add listing</Button>} />
      {!owner && (
        <div>
          <Segmented label="Filter listings" value={status ?? "all"} items={tabs} />
        </div>
      )}
      <Section flush>
        {items.length ? (
          <ListingsTable items={items} now={new Date().toISOString()} />
        ) : (
          <div className="sec-b">
            <Empty action={<Button href="/listings/new" variant="primary" size="sm" icon="plus">Add listing</Button>}>{status ? "No listings with this status." : "No listings yet."}</Empty>
          </div>
        )}
      </Section>
      {owner && items.length > 0 && (
        <section className="sec sec-b between" style={{ flexWrap: "wrap" }}>
          <div>
            <b>Selling another property?</b>
            <div className="muted" style={{ fontSize: 13.5 }}>
              Add it the same way. Each listing gets its own package.
            </div>
          </div>
          <Button href="/listings/new" icon="plus">
            Add another
          </Button>
        </section>
      )}
    </>
  );
}
