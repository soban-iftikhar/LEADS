import { describe, expect, it } from "vitest";
import { safeNext } from "./redirects";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/leads?stage=new")).toBe("/leads?stage=new");
  });
  it("rejects other origins and protocol-relative urls", () => {
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("/\\evil.example")).toBe("/dashboard");
  });
  it("falls back when missing", () => {
    expect(safeNext(undefined)).toBe("/dashboard");
  });
});
