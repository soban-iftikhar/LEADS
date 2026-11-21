import type { Metadata } from "next";
import { BuyLeads } from "@/components/app/BuyLeads";
import { activePlans } from "@/server/modules/catalog/service";
import { listMyListings } from "@/server/modules/listings/service";
import { requireCustomer } from "@/server/pages";

export const metadata: Metadata = { title: "Buy leads", robots: { index: false } };

export default async function BuyPage({ searchParams }: { searchParams: Promise<{ listing?: string; plan?: string }> }) {
  const { me, owner } = await requireCustomer("/packages/buy");
  const [sp, listings, plans] = await Promise.all([searchParams, listMyListings(owner, { status: "live", page: 1, pageSize: 100 }), activePlans()]);
  return <BuyLeads listings={listings.items} plans={plans} initialListing={sp.listing} initialPlan={sp.plan} now={new Date().toISOString()} owner={me.customer.kind === "SELLER"} />;
}
