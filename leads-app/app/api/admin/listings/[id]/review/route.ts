import { z } from "zod";
import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { reviewListing } from "@/server/modules/admin/service";

// POST /api/admin/listings/:id/review { decision, note? } -> { status }; the owner is notified
export const POST = route({
  auth: "listing:review",
  body: z
    .object({ decision: z.enum(["APPROVE", "REJECT", "NEED_INFO"]), note: z.string().trim().max(1000).optional() })
    .refine((b) => b.decision === "APPROVE" || !!b.note, { path: ["note"], message: "Tell the owner what to change." }),
  handler: async ({ ip, auth, body, params }) => ok(await reviewListing({ id: auth.user.id, ip }, String(params.id), body.decision, body.note)),
});
