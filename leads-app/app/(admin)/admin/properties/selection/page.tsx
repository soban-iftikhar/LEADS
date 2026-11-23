import type { Metadata } from "next";
import { KpiRow } from "@/components/ui/Kpi";
import { ResourceTable } from "@/features/admin/resource-table/ResourceTable";
import { inviteProperties } from "@/features/admin/selection/actions";
import { selectionConfig } from "@/features/admin/selection/config";
import { getAreaOptions, getSelection, getSelectionKpis } from "@/features/admin/selection/queries";
import { parseListParams } from "@/lib/admin/resource";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Selection" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SelectionPage({ searchParams }: { searchParams: SP }) {
  const params = parseListParams(await searchParams);
  const [result, kpis, areas] = await Promise.all([getSelection(params), getSelectionKpis(), getAreaOptions()]);
  const config = { ...selectionConfig, filter: { label: "Area", options: areas } };
  return (
    <ResourceTable
      config={config}
      result={result}
      params={params}
      rowAction={inviteProperties}
      kpis={
        <KpiRow
          items={[
            { label: "To invite", value: formatNumber(kpis.toInvite) },
            { label: "Invited this week", value: formatNumber(kpis.week) },
            { label: "Average score", value: kpis.avgScore === null ? "—" : String(kpis.avgScore) },
          ]}
        />
      }
    />
  );
}
