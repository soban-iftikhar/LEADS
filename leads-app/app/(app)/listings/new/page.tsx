import type { Metadata } from "next";
import { ListingForm } from "@/components/app/ListingForm";
import { getMe } from "@/lib/api";

export const metadata: Metadata = { title: "Add listing", robots: { index: false } };

/** Empty form; the first change creates the draft and moves the URL to /listings/<id>/edit. */
export default async function NewListingPage() {
  const me = await getMe();
  return <ListingForm listing={null} now={new Date().toISOString()} agency={me.customer.kind === "AGENCY"} />;
}
