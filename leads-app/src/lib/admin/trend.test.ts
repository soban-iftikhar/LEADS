import { describe, expect, it } from "vitest";
import { fillGaps, median, monotonePath, niceScale, pushLabels, toChange, type Pt } from "./trend";

// every control point's y must lie between its segment's end values (no overshoot)
function controlYs(d: string): number[][] {
  return [...d.matchAll(/C([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)/g)].map((m) => [Number(m[2]), Number(m[4]), Number(m[6])]);
}

describe("monotone path", () => {
  it("never overshoots a step", () => {
    const pts: Pt[] = [[0, 100], [10, 100], [20, 20], [30, 20], [40, 20]];
    const d = monotonePath(pts);
    const segs = controlYs(d);
    segs.forEach(([c1, c2, y1], i) => {
      const y0 = pts[i][1];
      const lo = Math.min(y0, y1);
      const hi = Math.max(y0, y1);
      expect(c1).toBeGreaterThanOrEqual(lo - 0.05);
      expect(c1).toBeLessThanOrEqual(hi + 0.05);
      expect(c2).toBeGreaterThanOrEqual(lo - 0.05);
      expect(c2).toBeLessThanOrEqual(hi + 0.05);
    });
  });

  it("is flat at a local peak", () => {
    const d = monotonePath([[0, 50], [10, 10], [20, 50]]);
    // second segment starts at the peak with a horizontal tangent: first control y = 10
    expect(controlYs(d)[1][0]).toBeCloseTo(10, 1);
  });

  it("draws straight lines for two points", () => {
    expect(monotonePath([[0, 1], [5, 2]])).toBe("M0.0 1.0L5.0 2.0");
  });
});

describe("scale and labels", () => {
  it("picks nice steps around the data", () => {
    const s = niceScale(21, 47);
    expect([1, 2, 2.5, 5, 10].map((k) => k * 10 ** Math.floor(Math.log10(s.step)))).toContain(s.step);
    expect(s.lo).toBeLessThanOrEqual(21);
    expect(s.hi).toBeGreaterThanOrEqual(47);
  });

  it("includes zero in change mode", () => {
    expect(niceScale(2, 9, true).ticks).toContain(0);
  });

  it("pushes labels at least the gap apart and keeps them in the chart", () => {
    const out = pushLabels([{ y: 100 }, { y: 105 }, { y: 108 }], 22, 300);
    expect(out.map((l) => l.y)).toEqual([100, 122, 144]);
    const low = pushLabels([{ y: 290 }, { y: 295 }], 22, 300);
    expect(low[1].y).toBeLessThanOrEqual(300);
    expect(low[1].y - low[0].y).toBe(22);
  });
});

describe("series", () => {
  it("turns prices into change from the first point", () => {
    expect(toChange([null, 20, 22, 25])).toEqual([null, 0, 10.000000000000009, 25]);
  });

  it("carries values over gaps and takes medians", () => {
    expect(fillGaps([null, 3, null, 5])).toEqual([null, 3, 3, 5]);
    expect(median([3, null, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([null])).toBeNull();
  });
});

describe("trend buckets", async () => {
  const { trendBuckets } = await import("./trend");
  it("ends on the bucket holding today", () => {
    expect(trendBuckets("day", 14, "2026-11-23").at(-1)).toEqual({ key: "2026-11-23", label: "Nov 23" });
    expect(trendBuckets("week", 12, "2026-11-25").at(-1)?.key).toBe("2026-11-23");
    expect(trendBuckets("month", 12, "2026-11-23").map((b) => b.label)).toEqual(["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]);
    expect(trendBuckets("year", 6, "2026-11-23")[0]).toEqual({ key: "2021-01-01", label: "2021" });
  });
});
