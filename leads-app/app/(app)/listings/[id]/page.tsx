import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingStatusView } from "@/components/app/ListingStatus";
import { ApiError, getListing } from "@/lib/api";

export const metadata: Metadata = { title: "Listing", robots: { index: false } };

export default async function ListingStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListing(id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return <ListingStatusView listing={listing} now={new Date().toISOString()} />;
}
