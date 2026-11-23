import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("keeps letters and digits, joins the rest with dashes", () => {
    expect(slugify("G-13/2, Islamabad")).toBe("g-13-2-islamabad");
    expect(slugify("  Bahria Town Phase 8 ")).toBe("bahria-town-phase-8");
    expect(slugify("///", "area")).toBe("area");
  });
});
