"use client";

import { useEffect, useRef, useState } from "react";

const NOTIFS = [
  { ini: "BA", name: "Bilal Ahmed", prop: "10 Marla house, G-13/2", ago: "now", said: '"Ji, interested. Corner hai?"', budget: "2.8–3.2 Cr", when: "Buying in 1–3 months", tone: "y" },
  { ini: "SK", name: "Sana Khan", prop: "10 Marla house, G-13/2", ago: "2h", said: '"Kab dekh sakte hain? Weekend ok?"', budget: "3.0–3.4 Cr", when: "Ready this month", tone: "t" },
  { ini: "UF", name: "Usman Farooq", prop: "10 Marla house, G-13/2", ago: "1d", said: "Filled in the property form", budget: "2.5–3.0 Cr", when: "Buying in 3–6 months", tone: "" },
];

const TONE: Record<string, { bg: string; fg: string }> = {
  y: { bg: "var(--m)", fg: "var(--on-m)" },
  t: { bg: "var(--m-tint)", fg: "var(--ink)" },
  "": { bg: "var(--surface-2)", fg: "var(--ink)" },
};

/** Phone showing leads arriving one by one once it scrolls into view. */
export function PhoneMock() {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(
      ([en]) => {
        if (!en.isIntersecting) return;
        io.disconnect();
        setSeen(true);
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
          setN(3);
          return;
        }
        setN(1);
        timer = setInterval(() => {
          if (!document.hidden) setN((x) => (x >= 3 ? 1 : x + 1));
        }, 3200);
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <div ref={ref} className={`rv d1 ${seen ? "in" : ""}`} style={{ flex: "1 1 380px", display: "flex", justifyContent: "center", position: "relative" }}>
      <div aria-hidden="true" style={{ position: "absolute", width: 380, maxWidth: "100%", aspectRatio: "1", borderRadius: "50%", background: "var(--m-tint)", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
      <div className="phone-f" aria-label="Example of leads arriving on your phone" role="img" style={{ position: "relative", width: 320, maxWidth: "100%", height: 640, borderRadius: 48, background: "var(--panel)", padding: 12, boxShadow: "var(--shadow-2)", transform: "rotate(-3deg)", border: "1px solid var(--line)" }}>
        <div style={{ height: "100%", borderRadius: 38, background: "var(--bg)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "24px 18px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 21, letterSpacing: "-.04em" }}>Your leads</span>
            <span className="mono" style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "var(--m)", color: "var(--on-m)" }}>
              {n} new
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "6px 12px" }}>
            {NOTIFS.slice(0, n).map((x) => (
              <div key={x.ini} className="notif" style={{ background: "var(--surface)", borderRadius: 18, padding: "13px 14px", display: "flex", flexDirection: "column", gap: 8, boxShadow: "var(--shadow)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 34, height: 34, borderRadius: "50%", background: TONE[x.tone].bg, color: TONE[x.tone].fg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flex: "none" }}>{x.ini}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{x.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{x.prop}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{x.ago}</span>
                </div>
                <div style={{ fontSize: 13.5, padding: "8px 11px", borderRadius: "4px 12px 12px 12px", background: "var(--m-soft)" }}>{x.said}</div>
                <div style={{ display: "flex", gap: 8, fontSize: 11.5, color: "var(--ink-2)" }}>
                  <span className="mono">{x.budget}</span>
                  <span>·</span>
                  <span>{x.when}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
