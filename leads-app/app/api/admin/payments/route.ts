import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { pendingPayments } from "@/server/modules/admin/service";

// GET /api/admin/payments -> { items } (payments waiting for a bank-transfer match)
export const GET = route({ auth: "payment:confirm", handler: async () => ok({ items: await pendingPayments() }) });
