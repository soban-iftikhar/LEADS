"use client";

import { useState } from "react";
import { ListingPic } from "@/components/ui/ListingPic";
import { useInView } from "@/lib/hooks/useInView";

const AUD = {
  seller: {
    points: ["List your house in about 10 minutes", "Every buyer who says yes lands in your inbox", "No agent in the middle unless you want one"],
    title: "My property",
    meta: "1 listing",
    rows: [{ name: "10 Marla house", loc: "G-13/2, Islamabad", leads: "12", kind: "HOUSE" as const, hot: true }],
  },
  agency: {
    points: ["All your listings in one account", "One inbox, every lead tagged by property", "One package, split across listings as you like"],
    title: "Al-Noor Estate · 24 listings",
    meta: "This month",
    rows: [
      { name: "10 Marla house", loc: "G-13/2, Islamabad", leads: "12", kind: "HOUSE" as const, hot: true },
      { name: "1 Kanal plot", loc: "DHA Phase 2", leads: "7", kind: "PLOT" as const, hot: false },
      { name: "5 Marla house", loc: "Bahria Town Phase 8", leads: "9", kind: "HOUSE" as const, hot: false },
      { name: "8 Marla house", loc: "B-17, Islamabad", leads: "4", kind: "HOUSE" as const, hot: false },
    ],
  },
};

const Check = () => (
  <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--m)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--on-m)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  </span>
);

export function AgencyTabs() {
  const [aud, setAud] = useState<"seller" | "agency">("agency");
  const a = AUD[aud];
  const { ref, seen } = useInView<HTMLDivElement>();
  const inCls = seen ? " in" : "";
  return (
    <div className="card" style={{ padding: "clamp(24px,5vw,64px)", display: "flex", flexWrap: "wrap", gap: "clamp(40px,6vw,96px)", alignItems: "center" }}>
      <div ref={ref} className={`rv${inCls}`} style={{ flex: "1 1 380px", display: "flex", flexDirection: "column", gap: 22 }}>
        <p className="kicker">For agencies</p>
        <h2 id="ag-h" className="h2" style={{ marginTop: 0 }}>
          Many listings? <span className="mk">One account.</span>
        </h2>
        <div role="tablist" aria-label="Account type" style={{ display: "inline-flex", alignSelf: "flex-start", padding: 4, gap: 4, borderRadius: 999, background: "var(--surface-2)" }}>
          <button type="button" className="tab" role="tab" id="aud-seller" aria-controls="aud-panel" aria-selected={aud === "seller"} onClick={() => setAud("seller")}>
            Owner
          </button>
          <button type="button" className="tab" role="tab" id="aud-agency" aria-controls="aud-panel" aria-selected={aud === "agency"} onClick={() => setAud("agency")}>
            Agency
          </button>
        </div>
        <ul id="aud-panel" role="tabpanel" aria-labelledby={`aud-${aud}`} style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
          {a.points.map((p) => (
            <li key={aud + p} className="rise" style={{ display: "flex", gap: 12, fontSize: 17, lineHeight: 1.5, alignItems: "center" }}>
              <Check />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={`rv d1${inCls}`} style={{ flex: "1 1 460px", padding: 18, borderRadius: 24, background: "var(--bg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px 14px" }}>
          <span style={{ fontWeight: 800 }}>{a.title}</span>
          <span className="mono" style={{ fontSize: 13, color: "var(--ink-3)" }}>{a.meta}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {a.rows.map((r) => (
            <div key={aud + r.name} className="rise" style={{ display: "grid", gridTemplateColumns: "46px 1fr auto", gap: 14, alignItems: "center", padding: "12px 14px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--line)" }}>
              <ListingPic kind={r.kind} hot={r.hot} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{r.loc}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontWeight: 600, fontSize: 18 }}>{r.leads}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>leads</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
