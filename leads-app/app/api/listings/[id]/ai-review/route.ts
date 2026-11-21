import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { ownerOf } from "@/server/modules/account/service";
import { aiReview } from "@/server/modules/listings/service";

// POST /api/listings/:id/ai-review -> { available, suggestion: { description, category } | null }. Saves nothing.
export const POST = route({
  auth: "listing:update:own",
  limits: [{ key: "listing-ai", limit: 20, windowSeconds: 3600 }],
  handler: async ({ auth, params }) => ok(await aiReview(ownerOf(auth.user), String(params.id))),
});
