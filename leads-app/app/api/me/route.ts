import { NextResponse } from "next/server";
import { mockCounts, mockHasActivePackage } from "@/mocks/bridge";
import { forget } from "@/mocks/store";
import { requireSession } from "@/server/auth/current";
import { clearSessionCookie } from "@/server/auth/sessions";
import { body, handle } from "@/server/http/handler";
import { successResponse } from "@/server/http/response";
import { deleteMeSchema, updateMeSchema } from "@/server/modules/auth/schema";
import { deleteAccount, toMe, updateProfile, userWithProfile } from "@/server/modules/auth/service";

async function meFor(id: string) {
  const u = await userWithProfile(id);
  if (!u) throw new Error("user vanished");
  // TODO(api): counts come from the mocked leads/listings/notifications until those modules exist
  return toMe(u, mockCounts(u));
}

// GET /api/me -> Me
export const GET = handle(async ({ request }) => {
  const { user } = await requireSession(request);
  return successResponse(await meFor(user.id));
});

// PATCH /api/me { displayName?, contactPerson?, email? } -> Me. A new email gets a fresh code.
// The WhatsApp number changes through POST /api/auth/phone + /api/auth/verify-phone instead.
export const PATCH = handle(async ({ request }) => {
  const { user } = await requireSession(request);
  const patch = await body(request, updateMeSchema);
  const u = await userWithProfile(user.id);
  if (!u) throw new Error("user vanished");
  await updateProfile(u, patch);
  return successResponse(await meFor(user.id));
});

// DELETE /api/me { password } -> 204; 409 while a package is active
export const DELETE = handle(async ({ request }) => {
  const { user } = await requireSession(request);
  const { password } = await body(request, deleteMeSchema);
  await deleteAccount(user, password, mockHasActivePackage(user));
  forget(user.id);
  const res = new NextResponse(null, { status: 204 });
  clearSessionCookie(res);
  return res;
});
