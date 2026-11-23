import type { Metadata } from "next";
import { saveAreaAction } from "@/features/admin/areas/actions";
import { areasConfig } from "@/features/admin/areas/config";
import { getAreas, getCityOptions } from "@/features/admin/areas/queries";
import { ResourceTable } from "@/features/admin/resource-table/ResourceTable";
import { parseListParams } from "@/lib/admin/resource";

export const metadata: Metadata = { title: "Areas" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AreasPage({ searchParams }: { searchParams: SP }) {
  const params = parseListParams(await searchParams);
  const [result, cities] = await Promise.all([getAreas(params), getCityOptions()]);
  return <ResourceTable config={areasConfig} result={result} params={params} options={{ regionId: cities }} save={saveAreaAction} />;
}
