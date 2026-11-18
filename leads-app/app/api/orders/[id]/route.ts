import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { getOrder } from "@/server/modules/orders/service";

// GET /api/orders/:id -> OrderDetail
export const GET = route({ auth: "order:read:own", handler: async ({ auth, params }) => ok(await getOrder(auth.user.id, String(params.id))) });
