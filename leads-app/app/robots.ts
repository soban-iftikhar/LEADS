import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: ["/", "/sell/"], disallow: ["/api/", "/dashboard", "/leads", "/listings", "/packages", "/checkout", "/notifications", "/settings", "/dev/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
