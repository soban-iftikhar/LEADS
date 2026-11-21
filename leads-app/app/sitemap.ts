import type { MetadataRoute } from "next";
import { areaPages } from "@/server/modules/catalog/service";

// built per request from config.localities, so new areas appear without a deploy
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const areas = await areaPages().catch((e) => {
    console.error("[sitemap] could not read areas:", String(e).slice(0, 200));
    return [];
  });
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...areas.map((a) => ({ url: `${base}/sell/${a.city}/${a.area}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
