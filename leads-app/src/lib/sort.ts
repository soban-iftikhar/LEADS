/**
 * Table sorting as URL state: `?sort=price.desc`. Headers cycle asc → desc → off. Services map the
 * key through a whitelist to their database ordering; an unknown key falls back to the default.
 * Text columns sort case-insensitively through the database collation (en_US.UTF-8).
 */

export type SortDir = "asc" | "desc";
export type Sort = { key: string; dir: SortDir };

const PATTERN = /^([a-zA-Z][a-zA-Z0-9]{0,39})\.(asc|desc)$/;

/** The sort in a URL value, or null when missing, malformed or not allowed. */
export function parseSort(raw: string | null | undefined, allowed: readonly string[]): Sort | null {
  const m = raw?.match(PATTERN);
  if (!m || !allowed.includes(m[1])) return null;
  return { key: m[1], dir: m[2] as SortDir };
}

export const formatSort = (s: Sort | null): string | null => (s ? `${s.key}.${s.dir}` : null);

/** Clicking a header: off → asc → desc → off, and a different column starts at asc. */
export function nextSort(current: Sort | null, key: string): Sort | null {
  if (!current || current.key !== key) return { key, dir: "asc" };
  return current.dir === "asc" ? { key, dir: "desc" } : null;
}

/** Value for the header's aria-sort. */
export function ariaSort(current: Sort | null, key: string): "ascending" | "descending" | "none" {
  if (current?.key !== key) return "none";
  return current.dir === "asc" ? "ascending" : "descending";
}

/**
 * The ordering for a list query: the whitelisted mapping for the URL sort, or the fallback.
 * A tie-breaker keeps pages stable when many rows share a value.
 */
export function orderFor<O>(raw: string | undefined, map: Record<string, (dir: SortDir) => O>, fallback: O, tieBreaker: O): O[] {
  const s = parseSort(raw, Object.keys(map));
  return [s ? map[s.key](s.dir) : fallback, tieBreaker];
}
