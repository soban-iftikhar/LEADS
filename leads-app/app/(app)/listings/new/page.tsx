import type { Metadata } from "next";
import { ListingForm } from "@/components/app/ListingForm";
import { activeRegions } from "@/server/modules/catalog/service";
import { requireCustomer } from "@/server/pages";

export const metadata: Metadata = { title: "Add listing", robots: { index: false } };

/** Empty form; the first change creates the draft and moves the URL to /listings/<id>/edit. */
export default async function NewListingPage() {
  const [{ me }, regions] = await Promise.all([requireCustomer("/listings/new"), activeRegions()]);
  const home = regions.find((r) => r.slug === me.customer.city) ?? regions[0];
  return <ListingForm listing={null} regions={regions} defaultRegionId={home?.id} now={new Date().toISOString()} agency={me.customer.kind === "AGENCY"} />;
}
