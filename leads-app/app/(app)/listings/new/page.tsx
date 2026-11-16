import type { Metadata } from "next";
import { ListingForm } from "@/components/app/ListingForm";

export const metadata: Metadata = { title: "Add listing", robots: { index: false } };

/** Empty form; the first change creates the draft and moves the URL to /listings/<id>/edit. */
export default function NewListingPage() {
  return <ListingForm listing={null} now={new Date().toISOString()} />;
}
