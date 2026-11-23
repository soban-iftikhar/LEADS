import { describe, expect, it } from "vitest";
import { areaAdvice, buyersPerHome, changeRatio, demandLevel, meterBlocks } from "./market";

describe("market formulas", () => {
  it("levels demand at the thresholds", () => {
    expect(demandLevel(1.8)).toBe("Hot");
    expect(demandLevel(1.79)).toBe("Warm");
    expect(demandLevel(1.2)).toBe("Warm");
    expect(demandLevel(1.19)).toBe("Cool");
  });

  it("divides buyers by homes and never by zero", () => {
    expect(buyersPerHome(514, 214)).toBeCloseTo(2.4, 1);
    expect(buyersPerHome(10, 0)).toBe(0);
  });

  it("fills the meter up to ten blocks", () => {
    expect(meterBlocks(0)).toBe(0);
    expect(meterBlocks(1.3)).toBe(5);
    expect(meterBlocks(9)).toBe(10);
  });

  it("measures change only with a start value", () => {
    expect(changeRatio(100, 109.1)).toBeCloseTo(0.091);
    expect(changeRatio(null, 5)).toBeNull();
    expect(changeRatio(0, 5)).toBeNull();
  });

  it("advises by level and price", () => {
    expect(areaAdvice("Hot", -0.1)).toMatch(/invite sellers here first/);
    expect(areaAdvice("Cool", 0)).toMatch(/small/);
  });
});
