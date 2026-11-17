import { describe, expect, it } from "vitest";
import { DEFAULT_QUALITY, listingTitle, OWNER_ACTIONS, qualityChecks, qualityScore, toSqft } from "./rules";

const complete = { category: "HOUSE", sizeValue: "10", localityId: "l1", pricePkr: BigInt(1), description: "x".repeat(40), photos: 5, documents: 1, phoneVerified: true };

describe("listing rules", () => {
  it("converts sizes with 225 sq ft per Marla and 20 Marla per Kanal", () => {
    expect(toSqft(10, "MARLA")).toBe(2250);
    expect(toSqft(1, "KANAL")).toBe(4500);
    expect(toSqft(100, "SQYD")).toBe(900);
  });

  it("titles a listing from its facts", () => {
    expect(listingTitle("HOUSE", "10", "MARLA")).toBe("10 Marla house");
    expect(listingTitle("PLOT", "7.50", "MARLA")).toBe("7.5 Marla plot");
    expect(listingTitle("COMMERCIAL", null, "MARLA")).toBe("New shop");
  });

  it("passes a complete listing and explains each missing piece", () => {
    expect(qualityScore(qualityChecks(complete, DEFAULT_QUALITY))).toBe(100);
    const checks = qualityChecks({ ...complete, photos: 3, documents: 0, phoneVerified: false }, DEFAULT_QUALITY);
    expect(checks.filter((c) => !c.passed).map((c) => c.key)).toEqual(["photos", "ownership_doc", "whatsapp"]);
    expect(checks.find((c) => c.key === "photos")?.hint).toBe("Add 2 more photos.");
    expect(checks.find((c) => c.key === "price")?.hint).toBeNull();
  });

  it("only allows the owner's own status moves", () => {
    expect(OWNER_ACTIONS.pause.from).toEqual(["APPROVED"]);
    expect(OWNER_ACTIONS["mark-sold"].to).toBe("SOLD");
    // an owner can only bring a listing back to live from their own pause, never approve it
    expect(Object.values(OWNER_ACTIONS).filter((a) => a.to === "APPROVED").flatMap((a) => a.from)).toEqual(["PAUSED"]);
  });
});
