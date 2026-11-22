import "server-only";
import { unstable_cache } from "next/cache";
import { activeRegions } from "@/server/modules/catalog/service";
import { overview } from "@/server/modules/admin/overview";
import type { Range } from "@/server/modules/admin/periods";
import { ADMIN_TAGS } from "@/server/modules/admin/refresh";
import type { OverviewParams } from "./schema";

// dashboard numbers: cached a few minutes, expired at once by any admin change (refreshAdminViews)
const cachedOverview = unstable_cache((regionId: string | null, range: Range) => overview({ regionId, range }), ["admin-overview"], {
  tags: [ADMIN_TAGS.overview],
  revalidate: 300,
});

/** The city choices come from config.regions; "all" covers every active city. */
export async function getCities(city: string) {
  const regions = await activeRegions();
  const region = regions.find((r) => r.slug === city) ?? null;
  const allLabel = regions.length === 2 ? "Both cities" : "All cities";
  return {
    region,
    options: [{ value: "all", label: allLabel }, ...regions.map((r) => ({ value: r.slug, label: r.name }))],
    label: region?.name ?? regions.map((r) => r.name).join(" + "),
  };
}

export const getOverview = (regionId: string | null, range: OverviewParams["range"]) => cachedOverview(regionId, range);
