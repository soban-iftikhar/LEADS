import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { activePlans } from "@/server/modules/catalog/service";

// GET /api/package-plans -> { items }
export const GET = route({ auth: "public", handler: async () => ok({ items: await activePlans() }) });
