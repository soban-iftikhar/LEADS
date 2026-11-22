import { describe, expect, it } from "vitest";
import { buckets, currentBucket, daysIn, periodBounds, startOfToday } from "./periods";

// Monday 23 Nov 2026, 2 pm in Karachi
const NOW = new Date("2026-11-23T09:00:00Z");

describe("dashboard periods", () => {
  it("splits this week into days from Monday, Karachi midnight", () => {
    const b = buckets("week", NOW);
    expect(b.map((x) => x.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(b[0].start.toISOString()).toBe("2026-11-22T19:00:00.000Z");
    expect(b[6].end.toISOString()).toBe("2026-11-29T19:00:00.000Z");
    expect(currentBucket(b, NOW)).toBe(0);
  });

  it("splits this month into weeks, the last one short", () => {
    const b = buckets("month", NOW);
    expect(b.map((x) => x.label)).toEqual(["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"]);
    expect(b.map(daysIn)).toEqual([7, 7, 7, 7, 2]);
    expect(currentBucket(b, NOW)).toBe(3);
  });

  it("covers three calendar months across a year boundary", () => {
    expect(buckets("quarter", new Date("2027-01-10T09:00:00Z")).map((x) => x.label)).toEqual(["Nov", "Dec", "Jan"]);
  });

  it("gives the previous period of the same length", () => {
    const p = periodBounds("week", NOW);
    expect(p.prevEnd).toEqual(p.start);
    expect(p.end.getTime() - p.start.getTime()).toBe(p.start.getTime() - p.prevStart.getTime());
  });

  it("starts today at Karachi midnight", () => {
    expect(startOfToday(new Date("2026-11-23T20:00:00Z")).toISOString()).toBe("2026-11-23T19:00:00.000Z");
  });
});
