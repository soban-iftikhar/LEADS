"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { cx } from "@/components/ui/cx";
import { monotonePath, niceScale, pushLabels, toChange } from "@/lib/admin/trend";
import "./charts.css";
import "./trend-chart.css";

export type TrendSeries = { key: string; name: string; color: string; values: (number | null)[] };

type Props = {
  labels: string[];
  series: TrendSeries[];
  /** Dashed reference line (the city median). */
  median: (number | null)[];
  medianLabel: string;
  mode: "price" | "change";
  /** Raw values are rupees; price mode shows them in lakh. */
  onOpen: (key: string) => void;
  emptyText: string;
};

const LABEL_GAP = 22;
const fmt = (mode: Props["mode"], v: number) => (mode === "price" ? `${v.toFixed(1)} Lac` : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

/** Smooth price lines with direct labels on the right, a hover crosshair and a sorted tooltip. */
export function TrendChart({ labels, series, median, medianLabel, mode, onOpen, emptyText }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  // drawn in real pixels: follow the box size
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const conv = (vals: (number | null)[]) => (mode === "price" ? vals.map((v) => (v === null ? null : v / 100_000)) : toChange(vals));
  const lines = series.map((s) => ({ ...s, vals: conv(s.values) }));
  const med = conv(median);
  const all = [...lines.flatMap((l) => l.vals), ...med].filter((v): v is number => v !== null);
  const n = labels.length;
  const { w: W, h: H } = size;
  const scale = all.length ? niceScale(Math.min(...all), Math.max(...all), mode === "change") : niceScale(0, 1);
  const y = (v: number) => (1 - (v - scale.lo) / (scale.hi - scale.lo)) * H;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const path = (vals: (number | null)[]) => monotonePath(vals.flatMap((v, i) => (v === null ? [] : [[x(i), y(v)] as [number, number]])));
  const lastOf = (vals: (number | null)[]) => [...vals].reverse().find((v) => v !== null) ?? null;
  const ends = pushLabels(
    lines.flatMap((l) => {
      const v = lastOf(l.vals);
      return v === null ? [] : [{ key: l.key, name: l.name, color: l.color, v, y: y(v) }];
    }),
    LABEL_GAP,
    H - 6,
  );
  const focused = lines.find((l) => l.key === focus);
  const medLast = lastOf(med);
  const empty = series.length === 0;

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!W || n < 2) return;
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / W) * (n - 1)))));
  };
  const tip =
    hover === null
      ? []
      : lines
          .map((l) => ({ key: l.key, name: l.name, color: l.color, v: l.vals[hover] }))
          .filter((r): r is { key: string; name: string; color: string; v: number } => r.v !== null && r.v !== undefined)
          .sort((a, b) => b.v - a.v);
  const summary = empty
    ? emptyText
    : `Price ${mode === "price" ? "per marla in lakh" : "change"} from ${labels[0]} to ${labels[n - 1]}: ${ends.map((e) => `${e.name} ${fmt(mode, e.v)}`).join(", ")}; ${medianLabel} ${medLast === null ? "none" : fmt(mode, medLast)}.`;

  return (
    <>
      <div className="lg-row">
        <span className="lg med">
          <i />
          {medianLabel}
          <em>{medLast === null ? "—" : fmt(mode, medLast)}</em>
        </span>
        <span className="muted lg-hint">Hover a name to focus its line · click it to open the area</span>
      </div>
      <div className="chart" ref={box} role="img" aria-label={summary}>
        {H > 0 &&
          scale.ticks.map((t) => (
            <span key={t}>
              <span className={cx("gl", mode === "change" && Math.abs(t) < scale.step / 1000 && "z")} style={{ top: y(t) }} />
              <span className="ya" style={{ top: y(t) }}>
                {mode === "price" ? t.toFixed(scale.step < 1 ? 1 : 0) : `${t > 0 ? "+" : ""}${t.toFixed(scale.step < 1 ? 1 : 0)}%`}
              </span>
            </span>
          ))}
        {W > 0 && !empty && (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            {focused && <path className="area" d={`${path(focused.vals)}L${W} ${H}L0 ${H}Z`} style={{ fill: focused.color }} />}
            <path className="mdn" d={path(med)} />
            {lines.map((l) => (
              <path key={l.key} className={cx("ln", focus && focus !== l.key && "dim")} d={path(l.vals)} pathLength={1} style={{ stroke: l.color }} />
            ))}
            {ends.map((e) => (
              <circle key={e.key} className={cx("edot", focus && focus !== e.key && "dim")} cx={W} cy={y(e.v)} r={5} style={{ fill: e.color }} />
            ))}
            {hover !== null &&
              tip.map((r) => <circle key={r.key} className="pdot" cx={x(hover)} cy={y(r.v)} r={6} style={{ fill: r.color }} />)}
          </svg>
        )}
        {ends.map((e) => (
          <button
            key={e.key}
            type="button"
            className={cx("elab", focus && focus !== e.key && "dim")}
            style={{ top: e.y }}
            onMouseEnter={() => setFocus(e.key)}
            onMouseLeave={() => setFocus(null)}
            onFocus={() => setFocus(e.key)}
            onBlur={() => setFocus(null)}
            onClick={() => onOpen(e.key)}
            aria-label={`${e.name} ${fmt(mode, e.v)}, open area`}
          >
            <i style={{ background: e.color }} />
            <span>{e.name}</span>
            <em>{fmt(mode, e.v)}</em>
          </button>
        ))}
        {empty && <div className="cempty">{emptyText}</div>}
        <div className="hov" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        {hover !== null && W > 0 && !empty && (
          <>
            <div className="vline" style={{ left: x(hover) }} />
            <div className={cx("ttip", x(hover) > W * 0.55 && "flip")} style={{ left: x(hover) }}>
              <b>{labels[hover]}</b>
              {tip.map((r) => (
                <div key={r.key}>
                  <i style={{ background: r.color }} />
                  <span>{r.name}</span>
                  <em>{fmt(mode, r.v)}</em>
                </div>
              ))}
              {med[hover] !== null && med[hover] !== undefined && (
                <div>
                  <i className="ti-med" />
                  <span>{medianLabel}</span>
                  <em>{fmt(mode, med[hover] as number)}</em>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="xl2" aria-hidden="true">
        {labels.map((l, i) =>
          n > 12 && i % 2 === 1 && i !== n - 1 ? null : (
            <span key={`${l}-${i}`} className={i === 0 ? "f" : i === n - 1 ? "l" : undefined} style={{ left: `${n <= 1 ? 0 : (i / (n - 1)) * 100}%` }}>
              {l}
            </span>
          ),
        )}
      </div>
    </>
  );
}
