import "server-only";
import type { z } from "zod";
import { failed, type ActionResult } from "@/lib/admin/action-result";
import { AppError } from "@/server/http/errors";
import { requireAdminActor, type AdminActor } from "./guard";

/**
 * Server action body shared by every admin mutation, in order: zod → admin role → service.
 * Known errors become a safe sentence; anything else is logged and answered generically.
 */
export function adminAction<S extends z.ZodType, T = undefined>(schema: S, run: (input: z.infer<S>, actor: AdminActor) => Promise<ActionResult<T>>) {
  return async (raw: unknown): Promise<ActionResult<T>> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
      return failed("Please check the highlighted fields.", fieldErrors);
    }
    try {
      return await run(parsed.data, await requireAdminActor());
    } catch (e) {
      if (e instanceof AppError) return failed(e.message, e.errors ?? undefined);
      console.error("[admin] action failed:", e);
      return failed("Something went wrong. Please try again.");
    }
  };
}
