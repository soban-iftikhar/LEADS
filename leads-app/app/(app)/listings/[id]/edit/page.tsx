import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ListingForm } from "@/components/app/ListingForm";
import { ApiError, getListing } from "@/lib/api";

export const metadata: Metadata = { title: "Edit listing", robots: { index: false } };

const EDITABLE = ["DRAFT", "NEEDS_INFO", "REJECTED", "APPROVED", "PAUSED"];

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListing(id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  if (!EDITABLE.includes(listing.status)) redirect(`/listings/${id}`);
  return <ListingForm listing={listing} now={new Date().toISOString()} />;
}
