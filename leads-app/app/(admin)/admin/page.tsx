import type { Metadata } from "next";
import { PageHeader } from "@/components/app/PageHeader";
import { greeting } from "@/lib/format";
import { requireAdmin } from "@/server/pages";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const { admin } = await requireAdmin("/admin");
  return <PageHeader title={`${greeting()}, ${admin.firstName}`} />;
}
