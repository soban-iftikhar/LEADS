import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { searchLocalities } from "@/server/modules/catalog/service";
import { localitiesQuerySchema } from "@/server/modules/listings/schema";

// GET /api/localities?region=<slug>&q= -> { items } (areas of an active city)
export const GET = route({
  auth: "public",
  query: localitiesQuerySchema,
  limits: [{ key: "localities", limit: 600, windowSeconds: 600 }],
  handler: async ({ query }) => ok({ items: await searchLocalities(query.region, query.q) }),
});
