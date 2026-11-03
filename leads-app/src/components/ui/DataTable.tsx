"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { cx } from "./cx";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Visually hidden header text for icon-only columns. */
  srHeader?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Whole row navigates here. Links and buttons inside the row keep their own click. */
  rowHref?: (row: T) => string;
  selected?: (row: T) => boolean;
  caption?: string;
  className?: string;
};

export function DataTable<T>({ columns, rows, rowKey, rowHref, selected, caption, className }: Props<T>) {
  const router = useRouter();
  const onRow = (e: MouseEvent<HTMLTableRowElement>, href?: string) => {
    if (!href) return;
    const t = e.target as HTMLElement;
    if (t.closest("a,button,input,select,textarea,label")) return;
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener");
    else router.push(href);
  };
  return (
    <div className="scroll-x">
      <table className={cx("tbl", className)}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.className}>
                {c.header}
                {c.srHeader && <span className="sr-only">{c.srHeader}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const href = rowHref?.(r);
            return (
              <tr key={rowKey(r)} className={cx(href && "clk", selected?.(r) && "is-sel")} onClick={(e) => onRow(e, href)}>
                {columns.map((c) => (
                  <td key={c.key} className={c.className}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
