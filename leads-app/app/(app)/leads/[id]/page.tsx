import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadDetailView } from "@/components/app/LeadDetail";
import { ApiError, getLead, getMe } from "@/lib/api";

export const metadata: Metadata = { title: "Lead", robots: { index: false } };

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ report?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [me, lead] = await Promise.all([
    getMe(),
    getLead(id).catch((e) => {
      // 404 whether it doesn't exist or isn't yours: never leak existence
      if (e instanceof ApiError && e.status === 404) notFound();
      throw e;
    }),
  ]);
  return <LeadDetailView lead={lead} displayName={me.customer.displayName} reportOpen={sp.report === "1"} now={new Date().toISOString()} />;
}
