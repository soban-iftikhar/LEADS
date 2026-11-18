import { z } from "zod";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { payOrder } from "@/server/modules/orders/service";

// POST /api/orders/:id/pay { method } -> { redirectUrl } | { instructions }
export const POST = route({
  auth: "order:create",
  body: z.object({ method: z.enum(["CARD", "JAZZCASH", "EASYPAISA", "BANK_TRANSFER"], { error: () => ({ message: "Pick how to pay." }) }) }),
  limits: [{ key: "order-pay", limit: 30, windowSeconds: 3600 }],
  handler: async ({ auth, body, params }) => ok(await payOrder(auth.user.id, String(params.id), body.method)),
});
