import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

/** Cache tags of the dashboard aggregates (unstable_cache in their queries). */
export const ADMIN_TAGS = { overview: "admin:overview", market: "admin:market" } as const;

/**
 * After any admin change: every admin page re-reads (lists are dynamic; the layout's menu badges
 * too) and the cached dashboard numbers expire now rather than on their timer.
 */
export function refreshAdminViews(): void {
  revalidatePath("/admin", "layout");
  for (const tag of Object.values(ADMIN_TAGS)) revalidateTag(tag, { expire: 0 });
}
