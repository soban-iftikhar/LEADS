import type { MetadataRoute } from "next";
import { allAreaSlugs } from "@/lib/areas";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...allAreaSlugs().map((a) => ({ url: `${base}/sell/${a.city}/${a.area}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
