import type { CellValue, Column } from "@/lib/admin/resource";
import { formatNumber, formatPkr } from "@/lib/format";

/** One table cell, drawn by column type. */
export function Cell({ col, v }: { col: Column; v: CellValue }) {
  if (v === null || v === undefined || v === "") return <span className="muted">—</span>;
  if (typeof v === "number") return <span className="num">{col.type === "money" ? formatPkr(v) : formatNumber(v)}</span>;
  if (typeof v === "string") return <>{v}</>;
  if ("a" in v)
    return (
      <div className="tt">
        <b>{v.a}</b>
        {v.b && <small>{v.b}</small>}
      </div>
    );
  if ("label" in v)
    return (
      <span className={`pill ${v.tone}`}>
        <i />
        {v.label}
      </span>
    );
  const pct = v.max > 0 ? Math.min(100, (v.value / v.max) * 100) : 0;
  return (
    <div className="pb">
      <span className="bar" role="progressbar" aria-valuenow={v.value} aria-valuemin={0} aria-valuemax={v.max} aria-label={`${v.value} of ${v.max}`}>
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="num">
        {v.value} / {v.max}
      </span>
    </div>
  );
}
