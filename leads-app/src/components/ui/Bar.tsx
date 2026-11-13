import { cx } from "./cx";

export function Bar({ value, max, label, thick, className }: { value: number; max: number; label?: string; thick?: boolean; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className={cx("bar", thick && "thick", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}
