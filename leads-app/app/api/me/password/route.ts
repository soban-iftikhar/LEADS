import { noContent } from "@/server/http/response";
import { route } from "@/server/http/route";
import { changePasswordSchema } from "@/server/modules/auth/schema";
import { changePassword } from "@/server/modules/auth/service";

// PATCH /api/me/password { currentPassword, newPassword } -> 204; other devices are signed out
export const PATCH = route({
  auth: "session:manage:own",
  body: changePasswordSchema,
  limits: [{ key: "password-change", limit: 10, windowSeconds: 3600 }],
  handler: async ({ auth, body }) => {
    await changePassword(auth.user, auth.session.id, body.currentPassword, body.newPassword);
    return noContent();
  },
});
