import "../../../test/env";
import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

const request = (xff?: string) =>
  new Request("http://localhost/api", { headers: xff ? { "x-forwarded-for": xff } : {} });

describe("clientIp", () => {
  it("uses the address written by our own proxy (last entry with one hop)", () => {
    expect(clientIp(request("203.0.113.7"))).toBe("203.0.113.7");
  });

  it("ignores addresses the caller put in the header", () => {
    // The caller sent "1.1.1.1, 2.2.2.2"; our proxy appended the real address.
    expect(clientIp(request("1.1.1.1, 2.2.2.2, 203.0.113.7"))).toBe("203.0.113.7");
  });

  it("puts callers without the header in one shared bucket", () => {
    expect(clientIp(request())).toBe("unknown");
  });
});
