"use client";

import { cx } from "@/components/ui/cx";
import type { Column } from "@/lib/admin/resource";
import { ariaSort, formatSort, nextSort, parseSort } from "@/lib/sort";

type Props = { col: Column; sort: string | undefined; sortKeys: string[]; onSort: (sort: string | undefined) => void };

/** Column header that cycles asc → desc → off. */
export function SortHeader({ col, sort, sortKeys, onSort }: Props) {
  if (!col.sort) return <th className={cx(col.right && "r")}>{col.label}</th>;
  const current = parseSort(sort, sortKeys);
  const aria = ariaSort(current, col.sort);
  const dir = aria === "ascending" ? "asc" : aria === "descending" ? "desc" : "";
  return (
    <th className={cx(col.right && "r")} aria-sort={aria}>
      <button type="button" className={cx("sort", dir)} onClick={() => onSort(formatSort(nextSort(current, col.sort as string)) ?? undefined)} title={`Sort by ${col.label}`}>
        {col.label}
        <svg width="12" height="14" viewBox="0 0 24 28" fill="none" strokeWidth="2.6" aria-hidden="true">
          <path className="up" d="M6 11l6-6 6 6" />
          <path className="dn" d="M6 17l6 6 6-6" />
        </svg>
      </button>
    </th>
  );
}
