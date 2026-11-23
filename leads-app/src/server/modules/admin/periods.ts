/**
 * Dashboard periods in Karachi time (UTC+5 all year, no daylight saving). A period is split into
 * buckets for the column chart: this week by day, this month by week, 3 months by month.
 */

export type Range = "week" | "month" | "quarter";
export type Bucket = { label: string; start: Date; end: Date };

const TZ_MS = 5 * 3_600_000;
const DAY_MS = 86_400_000;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Karachi calendar fields of an instant. */
function local(d: Date) {
  const k = new Date(d.getTime() + TZ_MS);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth(), day: k.getUTCDate(), dow: (k.getUTCDay() + 6) % 7 };
}
/** Instant of Karachi midnight on y-m-d (month/day may overflow; Date.UTC normalises). */
const midnight = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) - TZ_MS);

export function buckets(range: Range, now: Date = new Date()): Bucket[] {
  const { y, m, day, dow } = local(now);
  if (range === "week") {
    const monday = day - dow;
    return DAYS.map((label, i) => ({ label, start: midnight(y, m, monday + i), end: midnight(y, m, monday + i + 1) }));
  }
  if (range === "month") {
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const out: Bucket[] = [];
    for (let s = 1, w = 1; s <= last; s += 7, w++) out.push({ label: `Week ${w}`, start: midnight(y, m, s), end: midnight(y, m, Math.min(s + 7, last + 1)) });
    return out;
  }
  return [2, 1, 0].map((back) => ({ label: MONTHS[(m - back + 12) % 12], start: midnight(y, m - back, 1), end: midnight(y, m - back + 1, 1) }));
}

/** The whole period, and the same length just before it (for "vs previous period"). */
export function periodBounds(range: Range, now: Date = new Date()) {
  const b = buckets(range, now);
  const start = b[0].start;
  const end = b[b.length - 1].end;
  const len = end.getTime() - start.getTime();
  return { start, end, prevStart: new Date(start.getTime() - len), prevEnd: start };
}

export const daysIn = (b: Bucket) => Math.round((b.end.getTime() - b.start.getTime()) / DAY_MS);

/** Index of the bucket holding `now` (the yellow column). */
export const currentBucket = (bs: Bucket[], now: Date = new Date()) => Math.max(0, bs.findIndex((b) => now >= b.start && now < b.end));

/** Karachi midnight today, for "today" counters. */
export function startOfToday(now: Date = new Date()): Date {
  const { y, m, day } = local(now);
  return midnight(y, m, day);
}
