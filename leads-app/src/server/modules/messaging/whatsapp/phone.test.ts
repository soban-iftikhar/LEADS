import { describe, expect, it } from "vitest";
import { formatPakistaniPhone, maskPhone, normalizeForWhatsApp } from "./phone";

describe("normalizeForWhatsApp", () => {
  it.each([
    ["03001234567", "923001234567"],
    ["0300-1234567", "923001234567"],
    ["+92 300 1234567", "923001234567"],
    ["00923001234567", "923001234567"],
    ["3001234567", "923001234567"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeForWhatsApp(input)).toBe(expected);
  });

  it.each([null, undefined, "", "12345", "0511234567", "92300123"])("rejects %s", (input) => {
    expect(normalizeForWhatsApp(input)).toBeNull();
  });
});

describe("formatPakistaniPhone", () => {
  it("turns a local mobile number into international format", () => {
    expect(formatPakistaniPhone("03001234567")).toBe("923001234567");
    expect(formatPakistaniPhone("+923001234567")).toBe("923001234567");
  });
});

describe("maskPhone", () => {
  it("keeps only the last three digits", () => {
    expect(maskPhone("923001234567")).toBe("*********567");
  });
});
