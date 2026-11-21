import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { ownerOf } from "@/server/modules/account/service";
import { listingsQuerySchema } from "@/server/modules/listings/schema";
import { listMyListings } from "@/server/modules/listings/service";

// GET /api/listings/mine?status&page&pageSize -> { items, total, counts }
export const GET = route({ auth: "listing:read:own", query: listingsQuerySchema, handler: async ({ auth, query }) => ok(await listMyListings(ownerOf(auth.user), query)) });
