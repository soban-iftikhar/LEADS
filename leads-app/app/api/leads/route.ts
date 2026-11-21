import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { leadsQuerySchema } from "@/server/modules/leads/schema";
import { listLeads } from "@/server/modules/leads/service";

// GET /api/leads?stage&listing&q&page&pageSize -> Paged<LeadListItem> & { counts }
export const GET = route({ auth: "lead:read:own", query: leadsQuerySchema, handler: async ({ auth, query }) => ok(await listLeads(auth.user.id, query)) });
