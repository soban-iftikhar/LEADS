import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { confirmPaymentAsAdmin } from "@/server/modules/admin/service";

// POST /api/admin/payments/:id/confirm -> { orderId, status: "ACTIVE" }; the package starts
export const POST = route({ auth: "payment:confirm", handler: async ({ ip, auth, params }) => ok(await confirmPaymentAsAdmin({ id: auth.user.id, ip }, String(params.id))) });
