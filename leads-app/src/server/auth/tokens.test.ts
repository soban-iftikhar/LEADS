import "../../../test/env";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "./tokens";

const claims = { sub: "u1", sid: "s1", role: "CUSTOMER_SELLER" as const };

describe("access tokens", () => {
  it("round-trips the claims", () => {
    const v = verifyAccessToken(signAccessToken(claims));
    expect(v).toMatchObject(claims);
    expect(v?.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it("rejects missing, garbage and tampered tokens", () => {
    expect(verifyAccessToken(undefined)).toBeNull();
    expect(verifyAccessToken("not.a.token")).toBeNull();
    const [h, p, s] = signAccessToken(claims).split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), role: "ADMIN" })).toString("base64url");
    expect(verifyAccessToken(`${h}.${forged}.${s}`)).toBeNull();
  });

  it("rejects an unsigned (alg none) token", () => {
    const none = jwt.sign({ sid: "s1", role: "ADMIN" }, "", { algorithm: "none", subject: "u1", issuer: "leads", audience: "leads-web" });
    expect(verifyAccessToken(none)).toBeNull();
  });

  it("rejects a token signed with another secret or for another audience", () => {
    const other = jwt.sign({ sid: "s1", role: "ADMIN" }, "another-secret-another-secret-0123456", { subject: "u1", issuer: "leads", audience: "leads-web" });
    expect(verifyAccessToken(other)).toBeNull();
    const aud = jwt.sign({ sid: "s1", role: "ADMIN" }, process.env.JWT_SECRET as string, { subject: "u1", issuer: "leads", audience: "someone-else" });
    expect(verifyAccessToken(aud)).toBeNull();
  });

  it("rejects an expired token", () => {
    const old = jwt.sign({ sid: "s1", role: "CUSTOMER_SELLER", exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET as string, { subject: "u1", issuer: "leads", audience: "leads-web" });
    expect(verifyAccessToken(old)).toBeNull();
  });
});
