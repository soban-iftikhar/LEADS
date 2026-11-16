import type { Metadata } from "next";
import { BuyLeads } from "@/components/app/BuyLeads";
import { getMyListings, getPackagePlans } from "@/lib/api";

export const metadata: Metadata = { title: "Buy leads", robots: { index: false } };

export default async function BuyPage({ searchParams }: { searchParams: Promise<{ listing?: string; plan?: string }> }) {
  const [sp, listings, plans] = await Promise.all([searchParams, getMyListings({ status: "live", pageSize: 100 }), getPackagePlans()]);
  return <BuyLeads listings={listings.items} plans={plans.items} initialListing={sp.listing} initialPlan={sp.plan} now={new Date().toISOString()} />;
}
