import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListingForm } from "@/components/app/ListingForm";
import { activeRegions } from "@/server/modules/catalog/service";
import { getMyListing } from "@/server/modules/listings/service";
import { orNotFound, pageId, requireCustomer } from "@/server/pages";

export const metadata: Metadata = { title: "Edit listing", robots: { index: false } };


export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = pageId((await params).id);
  const { me, owner } = await requireCustomer(`/listings/${id}/edit`);
  const [listing, regions] = await Promise.all([orNotFound(getMyListing(owner, id)), activeRegions()]);
  if (!listing.editable) redirect(`/listings/${id}`);
  return <ListingForm listing={listing} regions={regions} now={new Date().toISOString()} agency={me.customer.kind === "AGENCY"} />;
}
