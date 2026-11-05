import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/current";
import { body, handle } from "@/server/http/handler";
import { changePasswordSchema } from "@/server/modules/auth/schema";
import { changePassword } from "@/server/modules/auth/service";

// PATCH /api/me/password { currentPassword, newPassword } -> 204; other sessions are signed out
export const PATCH = handle(
  async ({ request }) => {
    const { user, session } = await requireSession(request);
    const { currentPassword, newPassword } = await body(request, changePasswordSchema);
    await changePassword(user, session.id, currentPassword, newPassword);
    return new NextResponse(null, { status: 204 });
  },
  { limits: [{ key: "password-change", limit: 10, windowSeconds: 3600 }] },
);
