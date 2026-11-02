"use client";

import { useState } from "react";

/** "Say we deliver this many by day 60" slider: the gap comes back as money. */
export function PromiseSlider() {
  const [del, setDel] = useState(72);
  return (
    <div style={{ flex: "1 1 380px", display: "flex", flexDirection: "column", gap: 18 }}>
      <label htmlFor="del" style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: 600 }}>
        <span>Say we deliver this many by day 60</span>
        <span className="mono">{del} of 100</span>
      </label>
      <input id="del" type="range" min={0} max={100} step={1} value={del} onChange={(e) => setDel(Number(e.target.value))} />
      <div style={{ display: "flex", height: 64, borderRadius: 18, overflow: "hidden", background: "var(--panel-2)" }} aria-hidden="true">
        <span style={{ width: `${del}%`, background: "var(--on-panel)", transition: "width 160ms" }} />
        <span style={{ width: `${100 - del}%`, background: "repeating-linear-gradient(135deg,var(--m) 0 10px,var(--hard) 10px 20px)", transition: "width 160ms" }} />
      </div>
      <p style={{ margin: 0, fontSize: 20, lineHeight: 1.5 }}>
        You get{" "}
        <b className="mono" style={{ color: "var(--m)", fontSize: 28 }}>
          {100 - del}
        </b>{" "}
        leads&apos; worth of money back.
      </p>
    </div>
  );
}
