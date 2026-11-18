import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { dashboardSummary } from "@/server/modules/dashboard/service";

// GET /api/dashboard/summary -> DashboardSummary
export const GET = route({ auth: "lead:read:own", handler: async ({ auth }) => ok(await dashboardSummary(auth.user.id)) });
