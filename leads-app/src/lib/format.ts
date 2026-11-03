// Formatting rules for money, phones and dates. All dates shown in Asia/Karachi.

const TZ = "Asia/Karachi";
const B0 = BigInt(0);
const B2 = BigInt(2);
const B10 = BigInt(10);
const CRORE = BigInt(10_000_000);
const LAC = BigInt(100_000);

function toBig(n: string | number | bigint): bigint {
  if (typeof n === "bigint") return n;
  if (typeof n === "number") return BigInt(Math.round(n));
  return BigInt(n.trim() || "0");
}

/** One decimal, dropping ".0": 31000000 -> "3.1". */
function oneDecimal(n: bigint, unit: bigint): string {
  const tenths = (n * B10 + unit / B2) / unit;
  const whole = tenths / B10;
  const frac = tenths % B10;
  return frac === B0 ? `${whole}` : `${whole}.${frac}`;
}

/** Pakistani digit grouping: 24000000 -> "2,40,00,000". */
export function groupPk(n: string | number | bigint): string {
  const s = toBig(n).toString();
  const neg = s.startsWith("-");
  const d = neg ? s.slice(1) : s;
  if (d.length <= 3) return (neg ? "-" : "") + d;
  const last3 = d.slice(-3);
  const rest = d.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (neg ? "-" : "") + rest + "," + last3;
}

/** ≥ 1 Cr -> "3.1 Cr"; ≥ 1 Lac -> "85 Lac"; else "PKR 45,000". */
export function formatPkr(n: string | number | bigint): string {
  const v = toBig(n);
  if (v >= CRORE) return `${oneDecimal(v, CRORE)} Cr`;
  if (v >= LAC) return `${oneDecimal(v, LAC)} Lac`;
  return `PKR ${groupPk(v)}`;
}

/** Full form for inputs and totals: "PKR 2,40,00,000". */
export function formatPkrFull(n: string | number | bigint): string {
  return `PKR ${groupPk(n)}`;
}

/** Budget range: "2.8–3.2 Cr". Same unit shown once. */
export function formatBudget(min: string | null, max: string | null): string {
  if (!min && !max) return "—";
  if (!min || !max) return formatPkr((min ?? max) as string);
  const a = formatPkr(min);
  const b = formatPkr(max);
  const ua = a.split(" ").pop();
  const ub = b.split(" ").pop();
  if (ua === ub && (ua === "Cr" || ua === "Lac")) return `${a.replace(` ${ua}`, "")}–${b}`;
  return `${a}–${b}`;
}

/** "+923001234567" -> "+92 300 1234567". */
export function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  const local = d.startsWith("92") ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d;
  if (local.length !== 10) return e164;
  return `+92 ${local.slice(0, 3)} ${local.slice(3)}`;
}

/** "03001234567" / "3001234567" -> "+923001234567". */
export function toE164(local: string): string {
  const d = local.replace(/\D/g, "");
  const core = d.startsWith("92") ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d;
  return `+92${core}`;
}

/** Digits only, for wa.me links: "+923001234567" -> "923001234567". */
export function waDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}

function karachiParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const [day, month, year] = f.format(d).split("/").map(Number);
  return { day, month, year };
}

function dayNumber(d: Date): number {
  const { day, month, year } = karachiParts(d);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** "13 Nov", or "13 Nov 2025" when not this year. */
export function formatDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const sameYear = karachiParts(d).year === karachiParts(now).year;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(d);
}

/** "12 min", "5 h" under 24 h; then "Yesterday"; then a date. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const mins = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} h`;
  if (dayNumber(now) - dayNumber(d) === 1) return "Yesterday";
  return formatDate(iso, now);
}

/** "Friday, 13 November". */
export function formatLongDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(now);
}

/** "4:35 pm". */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(iso))
    .replace(/\s?([ap])\.?m\.?/i, " $1m")
    .toLowerCase();
}

/** "5 Nov, 4:10 pm". */
export function formatDateTime(iso: string, now: Date = new Date()): string {
  return `${formatDate(iso, now)}, ${formatTime(iso)}`;
}

/** "8 Oct – 6 Dec". */
export function formatWindow(start: string | null, end: string | null, now: Date = new Date()): string {
  if (!start || !end) return "—";
  return `${formatDate(start, now)} – ${formatDate(end, now)}`;
}

/** "Today" / "Yesterday" / "Earlier" bucket for notification groups. */
export function dayBucket(iso: string, now: Date = new Date()): "Today" | "Yesterday" | "Earlier" {
  const diff = dayNumber(now) - dayNumber(new Date(iso));
  return diff <= 0 ? "Today" : diff === 1 ? "Yesterday" : "Earlier";
}

/** "Bilal Ahmed" -> "Bilal". */
export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? "";
}

/** "13 Nov, 10:42" (24 h, used for message and activity stamps). */
export function formatStamp(iso: string, now: Date = new Date(), comma = true): string {
  const t = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  return `${formatDate(iso, now)}${comma ? "," : ""} ${t}`;
}

/** "Sat, 15 Nov · 4:00 pm". */
export function formatFollowUp(iso: string): string {
  const d = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
  return `${d} · ${formatTime(iso)}`;
}

/** ISO -> value for <input type="datetime-local"> in Karachi time. */
export function toLocalInput(iso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
}

/** <input type="datetime-local"> value (Karachi, UTC+5, no DST) -> ISO. */
export function fromLocalInput(v: string): string {
  return new Date(`${v}:00+05:00`).toISOString();
}
