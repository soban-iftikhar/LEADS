import { formatPkrFull } from "@/lib/format";
import type { CellValue, Column } from "./resource";

/** Plain text of a table cell, the way it reads on screen. */
export function cellText(col: Column, v: CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return col.type === "money" ? formatPkrFull(v) : String(v);
  if (typeof v === "string") return v;
  if ("a" in v) return v.b ? `${v.a} · ${v.b}` : v.a;
  if ("label" in v) return v.label;
  return `${v.value} / ${v.max}`;
}

/**
 * One CSV field. Quotes when needed, and defuses values a spreadsheet would run as a formula
 * (leading = + - @ tab or CR) by prefixing an apostrophe.
 */
export function csvField(text: string): string {
  const safe = /^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const csvLine = (fields: string[]) => fields.map(csvField).join(",") + "\r\n";
