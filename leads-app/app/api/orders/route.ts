import { z } from "zod";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { createOrder, listOrders } from "@/server/modules/orders/service";

// GET /api/orders?scope=active|past -> { items, totals }
export const GET = route({
  auth: "order:read:own",
  query: z.object({ scope: z.enum(["active", "past"]).default("active") }),
  handler: async ({ auth, query }) => ok(await listOrders(auth.user.id, query.scope)),
});

// POST /api/orders { listingId, packagePlanId } -> 201 { orderId }; 409 { orderId } when one already waits for payment
export const POST = route({
  auth: "order:create",
  body: z.object({ listingId: z.uuid({ error: "Pick a listing." }), packagePlanId: z.uuid({ error: "Pick a package." }) }),
  limits: [{ key: "order-create", limit: 30, windowSeconds: 3600 }],
  handler: async ({ auth, body }) => ok(await createOrder(auth.user.id, body.listingId, body.packagePlanId), 201),
});
