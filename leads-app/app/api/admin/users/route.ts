import { z } from "zod";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { listUsers } from "@/server/modules/admin/service";

// GET /api/admin/users?q&role&status&cursor -> { items, nextCursor }
export const GET = route({
  auth: "user:read:any",
  query: z.object({
    q: z.string().trim().max(100).optional(),
    role: z.enum(["CUSTOMER_SELLER", "CUSTOMER_AGENCY", "BUYER", "ADMIN"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
    cursor: z.uuid().optional(),
  }),
  handler: async ({ query }) => ok(await listUsers(query)),
});
