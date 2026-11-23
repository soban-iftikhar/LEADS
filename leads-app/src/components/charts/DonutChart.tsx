"use client";

import { useState } from "react";
import { cx } from "@/components/ui/cx";
import { formatNumber } from "@/lib/format";
import "./charts.css";

export type DonutSlice = { label: string; value: number; color: string };

type Props = { slices: DonutSlice[]; unit: string; label: string };

/** Ring with a list under it. Hovering or focusing a source highlights it and swaps the centre. */
export function DonutChart({ slices, unit, label }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);
  const pct = (v: number) => (total ? (v / total) * 100 : 0);
  // each arc starts where the previous ones end
  const arcs = slices.map((s, i) => {
    const p = pct(s.value);
    const before = slices.slice(0, i).reduce((a, x) => a + pct(x.value), 0);
    return { dash: `${p} ${100 - p}`, off: -before };
  });
  const centre = hover === null ? { v: total, l: unit } : { v: slices[hover].value, l: slices[hover].label };
  const summary = `${label}: ${slices.map((s) => `${s.label} ${s.value} (${Math.round(pct(s.value))}%)`).join(", ")}`;
  return (
    <div className="donut">
      <div className="dn-w">
        <svg viewBox="0 0 120 120" role="img" aria-label={summary}>
          <circle cx="60" cy="60" r="44" style={{ fill: "none", stroke: "var(--surface-2)", strokeWidth: 18 }} />
          {slices.map((s, i) => (
            <circle
              key={s.label}
              className={cx("seg-c", hover !== null && (hover === i ? "hv" : "dim"))}
              cx="60"
              cy="60"
              r="44"
              pathLength={100}
              style={{ stroke: s.color, strokeDasharray: arcs[i].dash, strokeDashoffset: arcs[i].off }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div className="dn-c" aria-live="polite">
          <b className="num">{formatNumber(centre.v)}</b>
          <span>{centre.l}</span>
        </div>
      </div>
      <div className="dlist">
        {slices.map((s, i) => (
          <button
            key={s.label}
            type="button"
            className={cx(hover === i && "hv")}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          >
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <em>{formatNumber(s.value)}</em>
            <small>{Math.round(pct(s.value))}%</small>
          </button>
        ))}
      </div>
    </div>
  );
}
