import { describe, expect, it } from "vitest";
import { dayBucket, formatBudget, formatDate, formatPhone, formatPkr, formatRelative, groupPk, toE164 } from "./format";

describe("formatPkr", () => {
  it("uses crore with one decimal and drops .0", () => {
    expect(formatPkr("31000000")).toBe("3.1 Cr");
    expect(formatPkr("20000000")).toBe("2 Cr");
  });
  it("uses lac between 1 lac and 1 crore", () => {
    expect(formatPkr("8500000")).toBe("85 Lac");
  });
  it("falls back to full rupees under 1 lac", () => {
    expect(formatPkr("45000")).toBe("PKR 45,000");
  });
});

describe("groupPk", () => {
  it("groups the Pakistani way", () => {
    expect(groupPk("24000000")).toBe("2,40,00,000");
    expect(groupPk("999")).toBe("999");
    expect(groupPk("1000")).toBe("1,000");
  });
});

describe("formatBudget", () => {
  it("shows one unit for a same-unit range", () => {
    expect(formatBudget("28000000", "32000000")).toBe("2.8–3.2 Cr");
  });
  it("shows a dash when unknown", () => {
    expect(formatBudget(null, null)).toBe("—");
  });
});

describe("phones", () => {
  it("formats E.164 for display", () => {
    expect(formatPhone("+923001234567")).toBe("+92 300 1234567");
  });
  it("converts local input to E.164", () => {
    expect(toE164("03001234567")).toBe("+923001234567");
    expect(toE164("300 1234567")).toBe("+923001234567");
  });
});

describe("dates", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  it("is relative under a day", () => {
    expect(formatRelative("2026-11-13T11:48:00Z", now)).toBe("12 min");
    expect(formatRelative("2026-11-13T07:00:00Z", now)).toBe("5 h");
  });
  it("says Yesterday, then a date", () => {
    expect(formatRelative("2026-11-12T05:00:00Z", now)).toBe("Yesterday");
    expect(formatRelative("2026-11-04T05:00:00Z", now)).toBe("4 Nov");
  });
  it("adds the year when not this year", () => {
    expect(formatDate("2025-11-13T05:00:00Z", now)).toBe("13 Nov 2025");
  });
  it("buckets by Karachi day", () => {
    expect(dayBucket("2026-11-13T02:00:00Z", now)).toBe("Today");
    expect(dayBucket("2026-11-12T02:00:00Z", now)).toBe("Yesterday");
    expect(dayBucket("2026-11-01T02:00:00Z", now)).toBe("Earlier");
  });
});
