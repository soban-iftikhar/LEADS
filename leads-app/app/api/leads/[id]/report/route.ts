import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { reportLeadSchema } from "@/server/modules/leads/schema";
import { reportLead } from "@/server/modules/leads/service";

// POST /api/leads/:id/report { reason, details? } -> { report: { status: "OPEN" } }
export const POST = route({
  auth: "lead:update:own",
  body: reportLeadSchema,
  limits: [{ key: "lead-report", limit: 30, windowSeconds: 3600 }],
  handler: async ({ auth, body, params }) => ok(await reportLead(auth.user.id, String(params.id), body.reason, body.details), 201),
});
