import "../../../../../test/env";
import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { isValidWebhookSignature } from "./webhook-signature";

const sign = (body: string, secret = "test-app-secret") =>
  "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

describe("isValidWebhookSignature", () => {
  const body = JSON.stringify({ entry: [] });

  it("accepts a body signed with the app secret", () => {
    expect(isValidWebhookSignature(body, sign(body))).toBe(true);
  });

  it("rejects a missing or malformed header", () => {
    expect(isValidWebhookSignature(body, null)).toBe(false);
    expect(isValidWebhookSignature(body, "sha256=zz")).toBe(false);
    expect(isValidWebhookSignature(body, "md5=abc")).toBe(false);
  });

  it("rejects a signature made with another secret", () => {
    expect(isValidWebhookSignature(body, sign(body, "wrong"))).toBe(false);
  });

  it("rejects a body changed after signing", () => {
    expect(isValidWebhookSignature(body + " ", sign(body))).toBe(false);
  });
});
