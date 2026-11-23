import { z } from "zod";
import { PAGE_SIZE, SEARCH_MAX } from "./constants";

/**
 * The generic list engine's contract. A list screen is a ResourceConfig (columns, form fields,
 * tabs, filter, row action) plus a service that returns ListResult for ListParams. Everything
 * here crosses from server to client, so it is plain data: no functions.
 */

export type Option = { value: string; label: string };
export type PillTone = "ok" | "warn" | "info" | "neutral" | "acc";

export type ColumnType = "title" | "text" | "num" | "money" | "pill" | "bar";
export type Column = {
  key: string;
  label: string;
  type: ColumnType;
  /** Sort key sent as ?sort=<key>.asc; omitted = not sortable. */
  sort?: string;
  /** Right-aligned (numbers, money). */
  right?: boolean;
};

export type CellValue =
  | string
  | number
  | null
  | { a: string; b?: string | null } // title: bold line + small line
  | { label: string; tone: PillTone } // pill
  | { value: number; max: number }; // bar (delivered of bought)

export type FieldKind = "text" | "number" | "select" | "email" | "tel" | "textarea";
export type Field = {
  key: string;
  label: string;
  kind: FieldKind;
  /** Static choices; a page can pass choices loaded from the database under the same key. */
  options?: Option[];
  hint?: string;
  /** Only shown when adding (e.g. a phone number that can't change later). */
  createOnly?: boolean;
  required?: boolean;
};

export type RowAction = {
  /** Shown in the bulk bar too (not for toggles like Pause/Resume, whose label depends on the row). */
  bulk?: boolean;
  /** Bulk bar label when it differs from the row label. */
  bulkLabel?: string;
};

export type ResourceConfig = {
  /** Key for archive/restore and CSV export. */
  resource: string;
  title: string;
  sub: string;
  /** Singular noun for messages: "1 listing archived". */
  noun: string;
  columns: Column[];
  tabs?: Option[];
  filter?: { label: string; options: Option[] };
  fields?: Field[];
  /** Shows the Add button with this label. */
  addLabel?: string;
  canEdit?: boolean;
  canArchive?: boolean;
  rowAction?: RowAction;
  /** Activity log: no checkboxes, no actions. */
  readOnly?: boolean;
  emptyHint?: string;
};

export type Row = {
  id: string;
  cells: Record<string, CellValue>;
  archived?: boolean;
  /** This row's action button (label depends on its state), or none. */
  action?: { label: string; confirm?: { title: string; text: string; label: string } } | null;
  /** Current values for the edit drawer, keyed by field. */
  values?: Record<string, string>;
};

export type ListResult = { rows: Row[]; total: number; counts: Record<string, number> };

const token = (max: number) => z.string().trim().regex(new RegExp(`^[a-z0-9_-]{1,${max}}$`, "i"));

/** URL state of every list: ?q=&tab=&filter=&sort=field.asc&page= (invalid values fall back). */
export const listParamsSchema = z.object({
  q: z.string().trim().max(SEARCH_MAX).catch(""),
  tab: token(24).catch("all"),
  filter: token(40).catch("all"),
  sort: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}\.(asc|desc)$/).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
});
export type ListParams = z.infer<typeof listParamsSchema>;

/** Next.js searchParams (string | string[]) to plain strings, first value wins. */
export function firstValues(sp: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s !== undefined) out[k] = s;
  }
  return out;
}

export const parseListParams = (sp: Record<string, string | string[] | undefined>): ListParams => listParamsSchema.parse(firstValues(sp));

/** Query string for the same list (empty values and defaults left out). */
export function listQuery(p: Partial<ListParams>): string {
  const q = new URLSearchParams();
  if (p.q) q.set("q", p.q);
  if (p.tab && p.tab !== "all") q.set("tab", p.tab);
  if (p.filter && p.filter !== "all") q.set("filter", p.filter);
  if (p.sort) q.set("sort", p.sort);
  if (p.page && p.page > 1) q.set("page", String(p.page));
  return q.toString();
}

/** skip/take for a page of a list (CSV export reads bigger pages). */
export const pageWindow = (page: number, take: number = PAGE_SIZE) => ({ skip: (page - 1) * take, take });

/** A list service: one page of rows for the URL state. */
export type ListFn = (params: ListParams, take?: number) => Promise<ListResult>;
