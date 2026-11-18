import type { Metadata } from "next";
import { ListingStatusView } from "@/components/app/ListingStatus";
import { getMyListing } from "@/server/modules/listings/service";
import { orNotFound, pageId, requireCustomer } from "@/server/pages";

export const metadata: Metadata = { title: "Listing", robots: { index: false } };

export default async function ListingStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const id = pageId((await params).id);
  const { owner } = await requireCustomer(`/listings/${id}`);
  const listing = await orNotFound(getMyListing(owner, id));
  return <ListingStatusView listing={listing} now={new Date().toISOString()} />;
}
