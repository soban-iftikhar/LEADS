import { requireSession } from "@/server/auth/current";
import { body, handle } from "@/server/http/handler";
import { successResponse } from "@/server/http/response";
import { prefsSchema } from "@/server/modules/auth/schema";
import { prefsOf, setPrefs, userWithProfile } from "@/server/modules/auth/service";

async function profile(id: string) {
  const u = await userWithProfile(id);
  if (!u) throw new Error("user vanished");
  return u;
}

// GET /api/me/notification-settings -> the 5 switches
export const GET = handle(async ({ request }) => {
  const { user } = await requireSession(request);
  return successResponse(prefsOf(await profile(user.id)));
});

// PATCH /api/me/notification-settings { any of the 5 } -> the 5 switches
export const PATCH = handle(async ({ request }) => {
  const { user } = await requireSession(request);
  const patch = await body(request, prefsSchema);
  return successResponse(await setPrefs(await profile(user.id), patch));
});
