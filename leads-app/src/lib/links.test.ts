import { describe, expect, it } from "vitest";
import { telHref, waHref } from "./links";

describe("links", () => {
  it("builds tel links", () => {
    expect(telHref("+923001234567")).toBe("tel:+923001234567");
  });
  it("builds wa.me links with the draft", () => {
    const h = waHref("+923001234567", "Bilal Ahmed", "Al-Noor Estate", "10 Marla house", "G-13/2");
    expect(h.startsWith("https://wa.me/923001234567?text=")).toBe(true);
    expect(decodeURIComponent(h.split("text=")[1])).toBe("Assalam o alaikum Bilal, this is Al-Noor Estate from LEADS about the 10 Marla house in G-13/2.");
  });
});
