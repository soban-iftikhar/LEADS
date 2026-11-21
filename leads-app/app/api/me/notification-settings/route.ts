import { ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { getPrefs, setPrefs } from "@/server/modules/account/service";
import { prefsSchema } from "@/server/modules/auth/schema";

// GET /api/me/notification-settings -> the 5 switches
export const GET = route({ auth: "profile:read:own", handler: async ({ auth }) => ok(await getPrefs(auth.user.id)) });

// PATCH /api/me/notification-settings { any of the 5 } -> the 5 switches
export const PATCH = route({ auth: "profile:update:own", body: prefsSchema, handler: async ({ auth, body }) => ok(await setPrefs(auth.user.id, body)) });
