import type { Metadata } from "next";
import { LeadDetailView } from "@/components/app/LeadDetail";
import { getLead } from "@/server/modules/leads/service";
import { orNotFound, pageId, requireCustomer } from "@/server/pages";

export const metadata: Metadata = { title: "Lead", robots: { index: false } };

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ report?: string }> }) {
  const [{ id: raw }, sp] = await Promise.all([params, searchParams]);
  const id = pageId(raw);
  const { me } = await requireCustomer(`/leads/${id}`);
  // 404 whether it doesn't exist or isn't yours: never leak existence
  const lead = await orNotFound(getLead(me.user.id, id));
  return <LeadDetailView lead={lead} displayName={me.customer.displayName} reportOpen={sp.report === "1"} now={new Date().toISOString()} />;
}
