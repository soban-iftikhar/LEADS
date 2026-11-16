import type { ReactNode } from "react";
import { Bar } from "./Bar";

export type Stat = {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  bar?: { value: number; max: number };
};

/** One card split into four cells. Two by two under 980px. */
export function StatStrip({ items, big }: { items: Stat[]; big?: boolean }) {
  return (
    <section className="sec" aria-label="Summary">
      <div className="stats">
        {items.map((s) => (
          <div key={s.label} className="stat">
            <span className="l">{s.label}</span>
            <span className="v" style={big ? { fontSize: 34 } : undefined}>
              {s.value}
              {s.unit && <small> {s.unit}</small>}
            </span>
            {s.bar && <Bar value={s.bar.value} max={s.bar.max} label={s.label} />}
            {s.sub && <span className="stat-sub">{s.sub}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
