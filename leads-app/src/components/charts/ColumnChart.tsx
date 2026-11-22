import { cx } from "@/components/ui/cx";
import { formatNumber } from "@/lib/format";
import "./charts.css";

export type ColumnBar = { label: string; value: number; now?: boolean; title?: string };

type Props = {
  bars: ColumnBar[];
  /** Dashed line across the chart. */
  target?: number;
  /** Text summary for screen readers. */
  summary: string;
  height?: number;
  format?: (n: number) => string;
  /** No y-axis labels (small charts in drawers). */
  bare?: boolean;
};

// three gridlines with room above the tallest bar
const scaleMax = (vals: number[]) => Math.max(5, Math.ceil((Math.max(0, ...vals) * 1.2) / 5) * 5);

/** Fat columns with the value on top; the current bucket is yellow, the rest grey. */
export function ColumnChart({ bars, target, summary, height = 240, format = formatNumber, bare }: Props) {
  const max = scaleMax([...bars.map((b) => b.value), target ?? 0]);
  const pad = 26;
  // percentage from the top inside the padded box, so labels line up with the bars
  const y = (v: number) => (pad / height) * 100 + (1 - v / max) * (100 - (pad / height) * 100);
  return (
    <>
      <div className={cx("vbars", bare && "flush")} style={{ height }} role="img" aria-label={summary}>
        {!bare &&
          [1, 0.5, 0].map((f) => (
            <span key={f}>
              <span className="gl" style={{ top: `${y(max * f)}%` }} />
              <span className="ya" style={{ top: `${y(max * f)}%` }}>
                {format(max * f)}
              </span>
            </span>
          ))}
        {target !== undefined && target > 0 && (
          <div className="tg" style={{ top: `${y(target)}%` }}>
            <span>target {format(target)}</span>
          </div>
        )}
        {bars.map((b) => (
          <div key={b.label} className={cx("vb", b.now && "now")} title={b.title ?? `${b.label}: ${format(b.value)}`}>
            <b>{format(b.value)}</b>
            <i style={{ height: `${(b.value / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className={cx("xl", bare && "flush")} aria-hidden="true">
        {bars.map((b) => (
          <span key={b.label}>{b.label}</span>
        ))}
      </div>
    </>
  );
}
