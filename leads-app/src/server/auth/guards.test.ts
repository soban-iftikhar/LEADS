import "../../../test/env";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { requireRole, requireUser } from "./guards";
import { signToken, type UserRole } from "./jwt";
import { SESSION_COOKIE } from "./session";

function request(role?: UserRole, token?: string) {
  const headers: Record<string, string> = {};
  const value = token ?? (role && signToken({ userId: "u1", email: "a@b.pk", role }));
  if (value) headers.cookie = `${SESSION_COOKIE}=${value}`;
  return new NextRequest("http://localhost/api/x", { headers });
}

describe("guards", () => {
  it("rejects a request with no session (401)", () => {
    const auth = requireUser(request());
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.response.status).toBe(401);
  });

  it("rejects a forged or garbage token (401)", () => {
    const auth = requireUser(request(undefined, "not.a.token"));
    expect(auth.ok).toBe(false);
  });

  it("accepts a signed-in user", () => {
    const auth = requireUser(request("SELLER"));
    expect(auth.ok).toBe(true);
    if (auth.ok) expect(auth.user.userId).toBe("u1");
  });

  it("rejects the wrong role (403) and accepts the right one", () => {
    const seller = requireRole(request("SELLER"), "ADMIN");
    expect(seller.ok).toBe(false);
    if (!seller.ok) expect(seller.response.status).toBe(403);
    expect(requireRole(request("ADMIN"), "ADMIN").ok).toBe(true);
  });
});
