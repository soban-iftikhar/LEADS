/** "G-13/2, Islamabad" -> "g-13-2-islamabad". `fallback` when nothing usable is left. */
export function slugify(s: string, fallback = "item"): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || fallback;
}
