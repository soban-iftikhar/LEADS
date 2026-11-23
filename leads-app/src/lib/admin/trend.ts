/** Maths for the price-trend chart. Pure, so it is tested without a browser. */

export type Pt = [number, number];

/**
 * Monotone cubic Hermite path (Fritsch–Carlson). Tangents are zero at local extremes and
 * clamped so each segment stays between its two points: smooth, but never above or below the
 * real values the way a plain spline overshoots.
 */
export function monotonePath(p: Pt[]): string {
  const f = (n: number) => n.toFixed(1);
  if (p.length < 3) return p.map((q, i) => `${i ? "L" : "M"}${f(q[0])} ${f(q[1])}`).join("");
  const n = p.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = p[i + 1][0] - p[i][0];
    m[i] = (p[i + 1][1] - p[i][1]) / dx[i];
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = a * a + b * b;
    // outside the circle of radius 3 the curve can overshoot: scale both tangents back onto it
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    d += `C${f(p[i][0] + dx[i] / 3)} ${f(p[i][1] + (t[i] * dx[i]) / 3)} ${f(p[i + 1][0] - dx[i] / 3)} ${f(p[i + 1][1] - (t[i + 1] * dx[i]) / 3)} ${f(p[i + 1][0])} ${f(p[i + 1][1])}`;
  }
  return d;
}

/** About four "nice" steps (1, 2, 2.5, 5 × 10ⁿ) covering [min, max] with 8% headroom. */
export function niceScale(min: number, max: number, includeZero = false): { lo: number; hi: number; step: number; ticks: number[] } {
  let mn = includeZero ? Math.min(min, 0) : min;
  let mx = includeZero ? Math.max(max, 0) : max;
  const pad = (mx - mn) * 0.08 || Math.abs(mx) * 0.08 || 1;
  mn -= pad;
  mx += pad;
  const raw = (mx - mn) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = ([1, 2, 2.5, 5, 10].find((k) => k * mag >= raw) ?? 10) * mag;
  const lo = Math.floor(mn / step) * step;
  const hi = Math.ceil(mx / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(Number(v.toFixed(10)));
  return { lo, hi, step, ticks };
}

/**
 * End-of-line labels sorted top to bottom and pushed apart so none is closer than `gap` px,
 * then shifted up as a block if the last one falls below the chart.
 */
export function pushLabels<T extends { y: number }>(labels: T[], gap: number, bottom: number): T[] {
  const out = labels.map((l) => ({ ...l })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < out.length; i++) if (out[i].y - out[i - 1].y < gap) out[i].y = out[i - 1].y + gap;
  const over = out.length ? out[out.length - 1].y - bottom : 0;
  if (over > 0) for (const l of out) l.y -= over;
  return out;
}

/** "Price change %" mode: each value against the series' first known value. */
export function toChange(values: (number | null)[]): (number | null)[] {
  const first = values.find((v) => v !== null && v !== 0) ?? null;
  return values.map((v) => (v === null || first === null ? null : (v / first - 1) * 100));
}

/** Gaps (a bucket with no snapshot) carry the previous value so lines don't break. */
export function fillGaps(values: (number | null)[]): (number | null)[] {
  let last: number | null = null;
  return values.map((v) => (v === null ? last : (last = v)));
}

/** Median of the non-null values. */
export function median(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Bucket start dates (YYYY-MM-DD, matching Postgres date_trunc on the snapshot day) and their
 * x-axis labels, oldest first, ending with the bucket that holds `today` (a Karachi date).
 */
export function trendBuckets(period: "day" | "week" | "month" | "year", points: number, today: string): { key: string; label: string }[] {
  const [y, m, d] = today.split("-").map(Number);
  const out: { key: string; label: string }[] = [];
  for (let back = points - 1; back >= 0; back--) {
    let start: Date;
    if (period === "day") start = new Date(Date.UTC(y, m - 1, d - back));
    else if (period === "week") {
      const t = new Date(Date.UTC(y, m - 1, d));
      const monday = d - ((t.getUTCDay() + 6) % 7);
      start = new Date(Date.UTC(y, m - 1, monday - back * 7));
    } else if (period === "month") start = new Date(Date.UTC(y, m - 1 - back, 1));
    else start = new Date(Date.UTC(y - back, 0, 1));
    const label = period === "year" ? String(start.getUTCFullYear()) : period === "month" ? MON[start.getUTCMonth()] : `${MON[start.getUTCMonth()]} ${start.getUTCDate()}`;
    out.push({ key: iso(start), label });
  }
  return out;
}
