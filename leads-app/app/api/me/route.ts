import { clearAuthCookies } from "@/server/auth/cookies";
import { noContent, ok } from "@/server/http/response";
import { route } from "@/server/http/route";
import { deleteAccount, getMe, updateProfile } from "@/server/modules/account/service";
import { deleteMeSchema, updateMeSchema } from "@/server/modules/auth/schema";

// GET /api/me -> Me
export const GET = route({ auth: "profile:read:own", handler: async ({ auth }) => ok(await getMe(auth.user.id)) });

// PATCH /api/me { displayName?, contactPerson?, email?, city? } -> Me. A new email gets a fresh code.
// The WhatsApp number changes through POST /api/auth/phone + /api/auth/verify-phone instead.
export const PATCH = route({
  auth: "profile:update:own",
  body: updateMeSchema,
  handler: async ({ auth, body }) => ok(await updateProfile(auth.user.id, body)),
});

// DELETE /api/me { password } -> 204, signed out; 409 while a package is active
export const DELETE = route({
  auth: "account:delete:own",
  body: deleteMeSchema,
  limits: [{ key: "delete-account", limit: 5, windowSeconds: 3600 }],
  handler: async ({ auth, body }) => {
    await deleteAccount(auth.user, body.password);
    const res = noContent();
    clearAuthCookies(res);
    return res;
  },
});
