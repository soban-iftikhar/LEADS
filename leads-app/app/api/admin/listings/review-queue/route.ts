import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { reviewQueue } from "@/server/modules/admin/service";

// GET /api/admin/listings/review-queue -> { items } (UNDER_REVIEW, oldest first)
export const GET = route({ auth: "listing:review", handler: async () => ok({ items: await reviewQueue() }) });
