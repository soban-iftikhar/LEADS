import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { setSuspended } from "@/server/modules/admin/service";

// POST /api/admin/users/:id/unsuspend -> { status: "ACTIVE" }
export const POST = route({ auth: "user:suspend", handler: async ({ ip, auth, params }) => ok(await setSuspended({ id: auth.user.id, ip }, String(params.id), false)) });
