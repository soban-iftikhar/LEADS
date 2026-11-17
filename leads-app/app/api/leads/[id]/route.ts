import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { patchLeadSchema } from "@/server/modules/leads/schema";
import { getLead, updateLead } from "@/server/modules/leads/service";

// GET /api/leads/:id -> LeadDetail
export const GET = route({ auth: "lead:read:own", handler: async ({ auth, params }) => ok(await getLead(auth.user.id, String(params.id))) });

// PATCH /api/leads/:id { customerStage?, note?, followUpAt?, followUpKind? } -> LeadDetail
export const PATCH = route({
  auth: "lead:update:own",
  body: patchLeadSchema,
  handler: async ({ auth, body, params }) => ok(await updateLead(auth.user.id, String(params.id), body)),
});
