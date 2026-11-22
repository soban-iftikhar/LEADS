import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { UrlSeg } from "@/components/ui/UrlSeg";
import { OverviewBody } from "@/features/admin/overview/components/OverviewBody";
import { getCities } from "@/features/admin/overview/queries";
import { overviewParamsSchema, RANGES } from "@/features/admin/overview/schema";
import { firstValues } from "@/lib/admin/resource";
import { greeting } from "@/lib/format";
import { requireAdmin } from "@/server/pages";

export const metadata: Metadata = { title: "Overview" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminOverviewPage({ searchParams }: { searchParams: SP }) {
  const { admin } = await requireAdmin("/admin");
  const p = overviewParamsSchema.parse(firstValues(await searchParams));
  const cities = await getCities(p.city);
  const rangeLabel = RANGES.find((r) => r.value === p.range)?.label.toLowerCase() ?? "";
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${admin.firstName}`}
        sub={`${cities.label} · ${rangeLabel}`}
        actions={
          <>
            <UrlSeg label="City" name="city" value={cities.region?.slug ?? "all"} options={cities.options} />
            <UrlSeg label="Period" name="range" value={p.range} options={[...RANGES]} />
          </>
        }
      />
      <Suspense key={`${p.city}-${p.range}`} fallback={<OverviewSkeleton />}>
        <OverviewBody regionId={cities.region?.id ?? null} range={p.range} cityLabel={cities.label} />
      </Suspense>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="pane-sub">
      <Skeleton h={56} />
      <div className="kpis">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} h={128} />
        ))}
      </div>
      <Skeleton h={56} />
      <Skeleton h={380} />
    </div>
  );
}
