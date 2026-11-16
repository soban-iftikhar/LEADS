"use client";

import { useEffect, useRef, useState } from "react";
import { Section } from "@/components/ui";

// Every colour token in design/tokens.css (+ rail), grouped as in the file.
const GROUPS: { title: string; names: string[] }[] = [
  { title: "Surfaces", names: ["bg", "surface", "surface-2", "line", "line-2"] },
  { title: "Text", names: ["ink", "ink-2", "ink-3", "hard"] },
  { title: "Brand (signboard yellow)", names: ["m", "m-h", "m-str", "m-ink", "m-soft", "m-tint", "m-mid", "on-m"] },
  { title: "Status (never red)", names: ["err", "err-soft", "ok", "ok-soft"] },
  { title: "Panel and rail", names: ["panel", "on-panel", "rail-bg", "rail-ink", "rail-mute", "rail-head"] },
  { title: "Illustration and bot", names: ["h-win", "g-park", "hill-1", "hill-2", "tree", "tree-2", "trunk", "glass", "bot-body", "bot-line", "bot-face"] },
];

const RADII = [
  { name: "r-xs", use: "chips, checkbox" },
  { name: "r-sm", use: "buttons, inputs, tabs" },
  { name: "r-md", use: "cards, modals" },
  { name: "r-pill", use: "switches only" },
];

const TYPE = [
  { label: "Page title (app h1)", style: { fontSize: 28, fontWeight: 800, letterSpacing: "-.035em" }, sample: "Overview" },
  { label: "Card title (h2)", style: { fontSize: 16, fontWeight: 700, letterSpacing: "-.01em" }, sample: "New leads" },
  { label: "Stat value", style: { fontSize: 24, fontWeight: 800, letterSpacing: "-.03em" }, sample: "104" },
  { label: "Body (app)", style: { fontSize: 15 }, sample: "Pay for buyers who said yes." },
  { label: "Small / meta", style: { fontSize: 13.5, fontWeight: 500, color: "var(--ink-3)" }, sample: "in 23 days · 10 Marla house" },
  { label: "Table header", style: { fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".05em", color: "var(--ink-3)" }, sample: "Buyer" },
  { label: "Mono (numbers)", style: { fontSize: 15, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }, sample: "PKR 2,40,00,000 · +92 300 1234567" },
];

/** Live colour values for this panel's theme (read from the computed style, so they can't drift). */
function useValues(names: string[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    setVals(Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])));
  }, [names]);
  return { ref, vals };
}

const ALL = GROUPS.flatMap((g) => g.names);

export function TokenSheet() {
  const { ref, vals } = useValues(ALL);
  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Section title="Colour tokens">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="tok-h">{g.title}</div>
              <div className="tok-grid">
                {g.names.map((n) => (
                  <div key={n} className="tok">
                    <span className="tok-sw" style={{ background: `var(--${n})` }} aria-hidden="true" />
                    <span className="tok-n mono">--{n}</span>
                    <span className="tok-v mono">{vals[n] ?? ""}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <div className="fgrid">
        <Section title="Radii">
          <div className="row" style={{ flexWrap: "wrap", gap: 16 }}>
            {RADII.map((r) => (
              <div key={r.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ width: 56, height: 40, border: "1.5px solid var(--ink)", background: "var(--m-soft)", borderRadius: `var(--${r.name})` }} />
                <span className="mono" style={{ fontSize: 12 }}>--{r.name}</span>
                <span className="muted" style={{ fontSize: 11.5 }}>{r.use}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Fonts">
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.03em" }}>Geist 400–900</div>
          <div className="mono" style={{ fontSize: 18, marginTop: 6 }}>Geist Mono 0123456789</div>
          <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>Loaded with next/font (no layout shift). Numbers, phones, IDs and money use mono.</p>
        </Section>
      </div>
      <Section title="Type scale">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {TYPE.map((t) => (
            <div key={t.label} className="tok-type">
              <span className="muted" style={{ fontSize: 12.5 }}>{t.label}</span>
              <span style={t.style}>{t.sample}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
