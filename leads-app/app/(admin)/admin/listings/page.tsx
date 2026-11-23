import type { Metadata } from "next";
import { listingsConfig } from "@/features/admin/listings/config";
import { getListings } from "@/features/admin/listings/queries";
import { ResourceTable } from "@/features/admin/resource-table/ResourceTable";
import { parseListParams } from "@/lib/admin/resource";

export const metadata: Metadata = { title: "All listings" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ListingsPage({ searchParams }: { searchParams: SP }) {
  const params = parseListParams(await searchParams);
  return <ResourceTable config={listingsConfig} result={await getListings(params)} params={params} />;
}
