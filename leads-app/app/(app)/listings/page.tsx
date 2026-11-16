import type { Metadata } from "next";
import { ListingsTable } from "@/components/app/ListingsTable";
import { PageHeader } from "@/components/app/PageHeader";
import { Button, Empty, Section, Segmented } from "@/components/ui";
import { getMyListings } from "@/lib/api";
import type { ListingFilter } from "@/lib/labels";

export const metadata: Metadata = { title: "Listings", robots: { index: false } };

const FILTERS: ListingFilter[] = ["live", "review", "info", "rejected", "draft", "paused", "sold"];

export default async function ListingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = FILTERS.includes(sp.status as ListingFilter) ? (sp.status as ListingFilter) : undefined;
  const { items, counts } = await getMyListings({ status, pageSize: 100 });
  const action = counts.info + counts.rejected;
  const sub = [`${counts.live} live`, `${counts.review} under review`, `${action} need${action === 1 ? "s" : ""} action`].join(" · ");
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
      <div>
        <Segmented label="Filter listings" value={status ?? "all"} items={tabs} />
      </div>
      <Section flush>
        {items.length ? (
          <ListingsTable items={items} now={new Date().toISOString()} />
        ) : (
          <div className="sec-b">
            <Empty action={<Button href="/listings/new" variant="primary" size="sm" icon="plus">Add listing</Button>}>{status ? "No listings with this status." : "No listings yet."}</Empty>
          </div>
        )}
      </Section>
    </>
  );
}
