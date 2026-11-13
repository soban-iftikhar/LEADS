"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

const STAGES = [
  { label: "List", text: "You add your house. We check it before it goes live." },
  { label: "Match", text: "We find people nearby who might buy it." },
  { label: "Message", text: "Each of them gets a WhatsApp about your house." },
  { label: "Reply", text: 'Someone writes back: "Ji, interested."' },
  { label: "Lead", text: "Their name and number come to you. Only you." },
  { label: "Sold", text: "You call, they visit, you agree. Done." },
];

type Van = {
  p: number;
  target: number;
  vel: number;
  dir: number;
  dist: number;
  auto: boolean;
  nextAt: number;
  resumeAt: number;
  drag: boolean;
  raf: number;
  last: number;
  drewStill: boolean;
  puffs: { x: number; y: number; a: number; r: number }[];
};

const VAR_KEYS = ["road", "lane", "post", "node", "node-line", "done", "done-txt", "txt", "body", "body-2", "cab", "glass", "tyre", "hub", "mark", "puff", "lamp"] as const;
type Colors = Record<(typeof VAR_KEYS)[number], string>;

function readColors(): Colors {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as Colors;
  for (const k of VAR_KEYS) out[k] = cs.getPropertyValue(`--van-${k}`).trim();
  return out;
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** A moving van drives the sale from stop to stop. Drag the van or tap a stop. */
export function FlowBar() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState(0);
  const [pad, setPad] = useState(72);
  const api = useRef<{ go: (i: number) => void }>({ go: () => {} });

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const v: Van = { p: 0, target: 0, vel: 0, dir: 1, dist: 0, auto: true, nextAt: 0, resumeAt: 0, drag: false, raf: 0, last: 0, drewStill: false, puffs: [] };
    let W = 0, H = 0;
    let colors = readColors();
    let shown = 0;
    let fonts = { mono: "monospace", sans: "sans-serif" };
    const cs = getComputedStyle(document.documentElement);
    fonts = { mono: cs.getPropertyValue("--font-geist-mono").trim() || "monospace", sans: cs.getPropertyValue("--font-geist").trim() || "sans-serif" };

    const padOf = () => Math.max(48, Math.min(96, (W || 900) * 0.065));
    const setIdx = (i: number) => {
      if (i !== shown) {
        shown = i;
        setStage(i);
      }
    };

    const draw = (t = 0) => {
      if (!W) return;
      const C = colors;
      const px = padOf();
      const X = (p: number) => px + (p / 5) * (W - 2 * px);
      const roadY = H - 34;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C.road;
      rr(ctx, 0, roadY - 14, W, 28, 14);
      ctx.fill();
      ctx.strokeStyle = C.lane;
      ctx.lineWidth = 3;
      ctx.setLineDash([16, 14]);
      ctx.lineDashOffset = -v.dist * 0.4;
      ctx.beginPath();
      ctx.moveTo(14, roadY);
      ctx.lineTo(W - 14, roadY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `600 12px ${fonts.mono}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < 6; i++) {
        const x = X(i);
        const passed = v.p >= i - 0.15;
        ctx.strokeStyle = C.post;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, roadY - 14);
        ctx.lineTo(x, roadY - 46);
        ctx.stroke();
        ctx.fillStyle = passed ? C.done : C.node;
        ctx.strokeStyle = passed ? C.done : C["node-line"];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, roadY - 58, 13, 0, 6.2832);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = passed ? C["done-txt"] : C.txt;
        ctx.fillText(String(i + 1), x, roadY - 57.5);
      }
      v.puffs.forEach((pf) => {
        ctx.fillStyle = `rgba(${C.puff},${(pf.a * 0.35).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(pf.x, roadY - 10 + pf.y, pf.r, 0, 6.2832);
        ctx.fill();
      });
      const x = X(v.p);
      const bob = Math.abs(v.vel) > 0.03 ? Math.sin(t / 60) * 0.8 : 0;
      ctx.save();
      ctx.translate(x, roadY - 4 + bob);
      ctx.scale(v.dir, 1);
      ctx.fillStyle = "rgba(0,0,0,.14)";
      ctx.beginPath();
      ctx.ellipse(0, 6, 46, 5, 0, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = C.body;
      rr(ctx, -44, -40, 62, 34, 6);
      ctx.fill();
      ctx.fillStyle = C.cab;
      ctx.beginPath();
      ctx.moveTo(18, -6);
      ctx.lineTo(18, -32);
      ctx.quadraticCurveTo(18, -36, 22, -36);
      ctx.lineTo(32, -36);
      ctx.quadraticCurveTo(36, -36, 39, -30);
      ctx.lineTo(46, -18);
      ctx.quadraticCurveTo(48, -15, 48, -11);
      ctx.lineTo(48, -6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.glass;
      ctx.beginPath();
      ctx.moveTo(23, -31);
      ctx.lineTo(33, -31);
      ctx.lineTo(41, -18);
      ctx.lineTo(23, -18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C["body-2"];
      ctx.fillRect(-44, -12, 92, 6);
      ctx.fillStyle = C.lamp;
      ctx.beginPath();
      ctx.arc(46, -12, 2.2, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = C.mark;
      ctx.beginPath();
      ctx.moveTo(-32, -26);
      ctx.lineTo(-26, -32);
      ctx.lineTo(-20, -26);
      ctx.lineTo(-20, -18);
      ctx.lineTo(-9, -18);
      ctx.lineTo(-9, -14);
      ctx.lineTo(-32, -14);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-11, -27, 3.2, 0, 6.2832);
      ctx.fill();
      ctx.save();
      ctx.translate(v.dir > 0 ? -4 : 14, -21);
      ctx.scale(v.dir, 1);
      ctx.font = `800 11px ${fonts.sans}`;
      ctx.textAlign = "left";
      ctx.fillText("leads", 0, 0);
      ctx.restore();
      for (const [wx, wy] of [
        [-28, -4],
        [32, -4],
      ]) {
        ctx.fillStyle = C.tyre;
        ctx.beginPath();
        ctx.arc(wx, wy, 8.5, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = C.hub;
        ctx.beginPath();
        ctx.arc(wx, wy, 3.6, 0, 6.2832);
        ctx.fill();
        const a = (v.dist / 8.5) * v.dir;
        ctx.strokeStyle = C.hub;
        ctx.lineWidth = 1.6;
        for (let s = 0; s < 3; s++) {
          const aa = a + s * 2.094;
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + Math.cos(aa) * 7, wy + Math.sin(aa) * 7);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const snap = () => {
      v.p = v.target;
      setIdx(Math.round(v.p));
      draw();
    };

    const tick = (t: number) => {
      const dt = v.last ? Math.min(50, t - v.last) : 16;
      v.last = t;
      if (!v.auto && !v.drag && t > v.resumeAt) {
        v.auto = true;
        v.nextAt = t + 2400;
      }
      if (v.auto && t > v.nextAt) {
        v.target = (Math.round(v.target) + 1) % 6;
        v.nextAt = t + (v.target === 0 ? 4200 : 3000);
      }
      const prev = v.p;
      v.p += (v.target - v.p) * Math.min(1, dt * (v.drag ? 0.02 : 0.0026));
      const px = padOf();
      const span = (W - 2 * px) / 5;
      const dx = (v.p - prev) * span;
      v.vel = dx / dt;
      if (Math.abs(v.vel) > 0.02) v.dir = v.vel > 0 ? 1 : -1;
      v.dist += dx;
      if (Math.abs(v.vel) > 0.05 && Math.random() < 0.3) v.puffs.push({ x: px + v.p * span - v.dir * 44, y: 0, a: 1, r: 3 });
      v.puffs.forEach((pf) => {
        pf.a -= dt * 0.0022;
        pf.r += dt * 0.012;
        pf.y -= dt * 0.012;
      });
      v.puffs = v.puffs.filter((pf) => pf.a > 0);
      setIdx(Math.max(0, Math.min(5, Math.round(v.p))));
      const still = Math.abs(v.target - v.p) < 0.002 && !v.puffs.length && !v.drag;
      if (still && v.drewStill) return;
      v.drewStill = still;
      draw(t);
    };

    const start = () => {
      if (v.raf) return;
      if (reduce) {
        draw();
        return;
      }
      v.last = 0;
      const loop = (t: number) => {
        v.raf = requestAnimationFrame(loop);
        if (!document.hidden) tick(t);
      };
      v.raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (v.raf) cancelAnimationFrame(v.raf);
      v.raf = 0;
    };

    const resize = () => {
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      W = w;
      H = h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      setPad(padOf());
      v.drewStill = false;
      draw();
    };

    const toP = (clientX: number) => {
      const r = cv.getBoundingClientRect();
      const px = padOf();
      return Math.max(0, Math.min(5, ((clientX - r.left - px) / (r.width - 2 * px)) * 5));
    };
    const down = (e: PointerEvent) => {
      v.drag = true;
      v.auto = false;
      cv.style.cursor = "grabbing";
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        // pointer capture is best effort
      }
      v.target = toP(e.clientX);
      if (reduce) snap();
    };
    const move = (e: PointerEvent) => {
      if (!v.drag) return;
      v.target = toP(e.clientX);
      if (reduce) snap();
    };
    const up = () => {
      if (!v.drag) return;
      v.drag = false;
      cv.style.cursor = "grab";
      v.target = Math.round(v.target);
      v.resumeAt = performance.now() + 6000;
      if (reduce) snap();
    };
    api.current.go = (i: number) => {
      v.target = i;
      v.auto = false;
      v.resumeAt = performance.now() + 6000;
      v.drewStill = false;
      if (reduce) snap();
    };

    const onTheme = () => {
      // tokens switch on the next frame after data-theme changes
      requestAnimationFrame(() => {
        colors = readColors();
        v.drewStill = false;
        draw();
      });
    };

    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    window.addEventListener("leads-theme", onTheme);
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    const io = new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop()));
    io.observe(cv);
    resize();
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointercancel", up);
      window.removeEventListener("leads-theme", onTheme);
    };
  }, []);

  const onKey = (i: number) => (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      api.current.go(Math.min(5, i + 1));
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      api.current.go(Math.max(0, i - 1));
    }
  };

  return (
    <section aria-labelledby="flow-h" style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
      <div className="wrap" style={{ paddingTop: 28, paddingBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <h2 id="flow-h" style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: "-.01em" }}>
            How a lead happens
          </h2>
          <span style={{ fontSize: 13.5, color: "var(--ink-3)" }}>Drag the van or tap a stop</span>
        </div>
        <div role="tablist" aria-label="Stages of a lead" style={{ position: "relative", height: 54 }}>
          {STAGES.map((st, i) => (
            <button
              key={st.label}
              type="button"
              className="stg"
              role="tab"
              aria-selected={i === stage}
              style={{ left: `calc(${pad}px + ${i} * (100% - ${2 * pad}px) / 5)` }}
              onClick={() => api.current.go(i)}
              onKeyDown={onKey(i)}
            >
              <b>0{i + 1}</b>
              <span>{st.label}</span>
            </button>
          ))}
        </div>
        <canvas ref={cvRef} aria-hidden="true" style={{ display: "block", width: "100%", height: 110, cursor: "grab", touchAction: "pan-y" }} />
        <p aria-live="polite" style={{ margin: "6px 0 0", textAlign: "center", fontSize: "clamp(16px,1.5vw,19px)", fontWeight: 600, letterSpacing: "-.01em" }}>
          {STAGES[stage].text}
        </p>
      </div>
    </section>
  );
}
