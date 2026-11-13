"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTheme } from "@/lib/useTheme";
import { arc, DURATIONS, keepIn, LOOP_HOMES, SCENE as G, type CarShape } from "./scene";

const CAPTIONS = [
  "Tap any house to see how LEADS works.",
  "You put your house on LEADS.",
  "We look for people nearby who might want it.",
  "We send each of them a WhatsApp message.",
  "Two of them reply: interested.",
  "Their names and numbers come to you. Only you.",
  "You call, they visit, you sell.",
];

const TOASTS = [
  { ini: "SI", name: "Soban Iftikhar", said: '"Ji, interested!" · 2.8–3.2 Cr', d: 300 },
  { ini: "MT", name: "Mamoon Tahir", said: '"Kab dekh sakte hain?" · 3.0–3.4 Cr', d: 1800 },
];

const CARS: { cls: string; delay: string; g: CarShape; n: "a" | "b" | "c" | "d" }[] = [
  { cls: "cA", delay: "0s", g: G.carI, n: "a" },
  { cls: "cB", delay: "-6s", g: G.carI, n: "b" },
  { cls: "cC", delay: "-3s", g: G.carJ, n: "c" },
  { cls: "cD", delay: "-8s", g: G.carJ, n: "d" },
];

type Story = { home: string | null; step: number; resetting: boolean; cands: string[]; yes: string[]; picked: boolean };

export function HeroStory() {
  const [s, setS] = useState<Story>({ home: null, step: 0, resetting: false, cands: [], yes: [], picked: false });
  const [visible, setVisible] = useState(true);
  const night = useTheme() === "dark";
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useRef(false);
  const loopIdx = useRef(0);
  const loopPending = useRef(false);
  const started = useRef(false);
  const visRef = useRef(true);
  const pickedRef = useRef(false);

  // The story engine lives in a ref: it schedules itself and never needs to re-render to run.
  const pickRef = useRef<(id: string, auto: boolean) => void>(() => {});

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    const later = (fn: () => void, ms: number) => {
      timers.current.push(setTimeout(fn, ms));
    };
    const pick = (id: string, auto: boolean) => {
      const home = G.byId[id];
      if (!home) return;
      clear();
      const others = G.houses
        .filter((hs) => hs.id !== id)
        .map((hs) => ({ hs, d: Math.hypot(hs.gx - home.gx, hs.gy - home.gy), r: (hs.i * 7 + hs.j * 11 + home.i * 3 + home.j * 5) % 13 }));
      others.sort((p, q) => p.r - q.r);
      const cands = others.slice(0, 6).sort((p, q) => p.d - q.d);
      const yes = cands.slice(-2).map((o) => o.hs.id);
      pickedRef.current = pickedRef.current || !auto;
      const base = { home: id, cands: cands.map((o) => o.hs.id), yes, picked: pickedRef.current };
      if (reduce.current) {
        setS({ ...base, step: 7, resetting: false });
        return;
      }
      setS({ ...base, step: 0, resetting: true });
      const go = (step: number) => {
        setS((p) => ({ ...p, step, resetting: false }));
        if (step < 6) {
          later(() => go(step + 1), DURATIONS[step]);
          return;
        }
        later(() => {
          setS((p) => ({ ...p, step: 7 }));
          later(() => {
            if (!visRef.current || document.hidden) {
              loopPending.current = true;
              return;
            }
            loopIdx.current = (loopIdx.current + 1) % LOOP_HOMES.length;
            pick(LOOP_HOMES[loopIdx.current], true);
          }, 2600);
        }, DURATIONS[6]);
      };
      later(() => go(1), 80);
    };
    pickRef.current = pick;

    reduce.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const el = wrapRef.current;
    const io = new IntersectionObserver(
      ([en]) => {
        visRef.current = en.isIntersecting;
        setVisible(en.isIntersecting);
        if (en.isIntersecting && loopPending.current) {
          loopPending.current = false;
          loopIdx.current = (loopIdx.current + 1) % LOOP_HOMES.length;
          pick(LOOP_HOMES[loopIdx.current], true);
        }
        if (en.isIntersecting && !started.current) {
          started.current = true;
          later(() => {
            if (!pickedRef.current) pick(G.defaultHome, true);
          }, 3200);
        }
      },
      { threshold: 0.15 },
    );
    if (el) io.observe(el);
    return () => {
      io.disconnect();
      clear();
    };
  }, []);

  const { step } = s;
  const done = (n: number) => step >= n;
  const home = s.home ? G.byId[s.home] : null;

  const view = useMemo(() => {
    const yesSet = new Set(s.yes);
    const candSet = new Set(s.cands);
    const candIdx: Record<string, number> = {};
    s.cands.forEach((id, n) => {
      candIdx[id] = n;
    });
    const pct = (x: number, y: number) => ({ left: ((x - 170) / 8.6).toFixed(2) + "%", top: ((y - 30) / 5.8).toFixed(2) + "%" });
    const zs = home && step >= 1 && step <= 5 ? 1.18 : 1;
    const zo = home ? pct(home.rcx, home.rcy) : { left: "50%", top: "50%" };
    const hp = home ? { x: home.rcx, y: home.rcy - 40 } : { x: 0, y: 0 };
    const cands = home
      ? s.cands.map((id, n) => {
          const hs = G.byId[id];
          const go = step >= 3;
          const a = arc(hp, { x: hs.rcx, y: hs.rcy - 30 }, 80);
          return {
            id,
            cx: hs.rcx,
            my: hs.rcy - 30,
            d1: n * 300,
            arc: a.d,
            len: a.len,
            off: go ? 0 : a.len,
            tx: go ? (hs.rcx - hp.x).toFixed(1) : "0",
            ty: go ? (hs.rcy - 30 - hp.y).toFixed(1) : "0",
            d2: n * 520,
            ok: yesSet.has(id),
          };
        })
      : [];
    let prev: { x: number; y: number } | null = null;
    const yesList = home
      ? s.yes.map((id, n) => {
          const hs = G.byId[id];
          const sx = hs.rcx, sy = hs.rcy - 30;
          const go = step >= 5;
          const a = arc({ x: sx, y: sy }, hp, 110);
          const k = keepIn(hs.rcx, hs.rcy - 46, home, n === 1 ? prev : null);
          prev = k.pos;
          return {
            id,
            gx: hs.gx,
            gy: hs.gy,
            sx,
            sy,
            ret: a.d,
            len: a.len,
            off: go ? 0 : a.len,
            tx: go ? (hp.x - sx + (n ? 46 : -46)).toFixed(1) : "0",
            ty: go ? (hp.y - sy - 28 - n * 6).toFixed(1) : "0",
            d: n * 900,
            bd: n * 1500,
            left: k.left,
            top: k.top,
          };
        })
      : [];
    const houseCls = (id: string) => {
      if (home && id === home.id && step >= 1) return "home";
      if (yesSet.has(id)) return "cand yes";
      if (candSet.has(id)) return "cand";
      return "";
    };
    return { zoom: { o: `${zo.left} ${zo.top}`, t: `scale(${zs})` }, hp, cands, yesList, houseCls, candIdx };
  }, [s.yes, s.cands, home, step]);

  let sceneCls = [1, 2, 3, 4, 5, 6].filter((n) => done(n)).map((n) => "r" + n).join(" ");
  if (step === 4 || step === 5) sceneCls += " live";
  if (s.resetting) sceneCls += " reset";
  if (!visible) sceneCls += " paused";

  const capStep = step >= 7 ? 6 : step;
  const statusText =
    step >= 6 && home
      ? home.name.split(" · ")[0] + " sold"
      : step >= 5
        ? "2 new leads for you"
        : step >= 4
          ? "2 people said yes"
          : step >= 3
            ? "Messaging 6 people"
            : step >= 2
              ? "Finding buyers nearby"
              : "Listed on LEADS";
  const trayCount = step >= 5 ? "2 new leads" : step >= 4 ? "2 replies" : "empty";
  const hint = G.byId[G.defaultHome];
  const onKey = (id: string) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pickRef.current(id, false);
    }
  };

  return (
    <div ref={wrapRef} className="zoomin" style={{ flex: "1.45 1 560px", minWidth: 0 }}>
      <div className={`stage ${sceneCls}`} style={{ position: "relative", overflow: "hidden" }}>
        <div className="zoomer" style={{ transformOrigin: view.zoom.o, transform: view.zoom.t }}>
          <svg className="scene" viewBox="170 30 860 580" role="group" aria-label="A neighbourhood in Islamabad. Choose a house to see how LEADS finds buyers for it.">
            <g>
              <g className={`sky ${night ? "night" : ""}`} aria-hidden="true">
                <g transform="translate(0 16)">
                  <mask id="moonBite">
                    <rect x="560" y="40" width="160" height="120" fill="white" />
                    <circle cx="656" cy="80" r="26" fill="black" />
                  </mask>
                  <g style={{ fill: "var(--star)" }}>
                    <path className="st" d="M420 66l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
                    <path className="st" d="M760 52l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" />
                    <path className="st" d="M990 74l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
                    <circle className="st" cx="500" cy="108" r="2" />
                    <circle className="st" cx="830" cy="112" r="2.2" />
                    <circle className="st" cx="360" cy="122" r="1.8" />
                    <circle className="st" cx="560" cy="58" r="1.6" />
                    <circle className="st" cx="900" cy="60" r="1.8" />
                  </g>
                  <g className="sun">
                    <g className="rays" style={{ stroke: "var(--m)", strokeWidth: 4, strokeLinecap: "round" }}>
                      <path d="M600 42v-10M600 158v10M542 100h-10M658 100h10M559 59l-7-7M641 141l7 7M559 141l-7 7M641 59l7-7" />
                    </g>
                    <circle cx="600" cy="100" r="46" style={{ fill: "var(--m)", opacity: 0.16 }} />
                    <circle cx="600" cy="100" r="32" style={{ fill: "var(--m)", stroke: "var(--hard)", strokeWidth: 2.5 }} />
                    <path d="M588 104q12 10 24 0" style={{ fill: "none", stroke: "var(--hard)", strokeWidth: 2.5, strokeLinecap: "round" }} />
                    <circle cx="589" cy="94" r="2.6" style={{ fill: "var(--hard)" }} />
                    <circle cx="611" cy="94" r="2.6" style={{ fill: "var(--hard)" }} />
                  </g>
                  <g className="moon">
                    <circle cx="640" cy="96" r="30" mask="url(#moonBite)" style={{ fill: "var(--star)" }} />
                    <path d="M622 100q4 4 8 0" style={{ fill: "none", stroke: "var(--bg)", strokeWidth: 2.2, strokeLinecap: "round" }} mask="url(#moonBite)" />
                    <path d="M620 90q3-2.5 6 0" style={{ fill: "none", stroke: "var(--bg)", strokeWidth: 2.2, strokeLinecap: "round" }} />
                  </g>
                </g>
              </g>
              <path d="M40 330 C160 190 260 160 380 205 C470 150 580 120 690 170 C790 130 930 140 1160 300 L1160 380 L40 380Z" style={{ fill: "var(--hill-1)" }} />
              <path d="M110 350 C230 250 330 245 440 262 C540 220 660 210 760 240 C880 205 1000 235 1110 330 L1110 380 L110 380Z" style={{ fill: "var(--hill-2)" }} />
              <g style={{ fill: "var(--mosque)" }}>
                <path d="M282 212 308 188 334 212z" />
                <rect x="268" y="174" width="3" height="40" />
                <rect x="345" y="174" width="3" height="40" />
                <rect x="288" y="182" width="2.4" height="32" />
                <rect x="326" y="182" width="2.4" height="32" />
              </g>
              <text x="308" y="232" textAnchor="middle" style={{ font: "600 9.5px var(--font-mono)", letterSpacing: ".16em", fill: "var(--ink-3)" }}>
                FAISAL MOSQUE
              </text>
              <text x="880" y="214" textAnchor="middle" style={{ font: "600 9.5px var(--font-mono)", letterSpacing: ".16em", fill: "var(--ink-3)" }}>
                MARGALLA HILLS
              </text>
              <g transform="translate(930 96)" aria-hidden="true">
                <g className="kite">
                  <path d="M0 26 L-210 250" style={{ stroke: "var(--ink-3)", strokeWidth: 0.8, opacity: 0.6 }} />
                  <path d="M0 -24 L17 0 L0 26 L-17 0Z" style={{ fill: "var(--m)", stroke: "var(--hard)", strokeWidth: 1.5, strokeLinejoin: "round" }} />
                  <path d="M0 -24V26M-17 0H17" style={{ stroke: "var(--hard)", strokeWidth: 1.2, opacity: 0.5 }} />
                  <path className="tail" d="M0 26 q-8 9 0 18 q8 9 0 18 q-8 9 0 18" style={{ fill: "none", stroke: "var(--ink-3)", strokeWidth: 1.6, strokeLinecap: "round" }} />
                </g>
              </g>
              <polygon points={G.slabL} style={{ fill: "var(--g-slab-l)" }} />
              <polygon points={G.slabR} style={{ fill: "var(--g-slab-r)" }} />
              <polygon points={G.ground} style={{ fill: "var(--g-ground)" }} />
              {G.roads.map((r) => (
                <polygon key={r} points={r} style={{ fill: "var(--g-road)" }} />
              ))}
              {G.parks.map((p) => (
                <polygon key={p} points={p} style={{ fill: "var(--g-park)" }} />
              ))}
              <path d={G.dash} style={{ fill: "none", stroke: "var(--g-dash)", strokeWidth: 2, strokeDasharray: "10 10" }} />
              <text x="828" y="520" transform="rotate(26.57 828 520)" style={{ font: "600 11px var(--font-mono)", letterSpacing: ".14em", fill: "var(--ink-3)" }}>
                STREET 7 · G-13/2
              </text>
              {home &&
                ["", "b", "c"].map((c) => <ellipse key={c || "a"} className={`radar ${c}`} cx={home.gx} cy={home.gy} rx="340" ry="170" />)}
              {CARS.map((c) => (
                <g key={c.cls} className={`car ${c.cls}`} style={{ animationDelay: c.delay }} aria-hidden="true">
                  <g className="bounce">
                    <ellipse cx="0" cy="2" rx="20" ry="9" style={{ fill: "black", opacity: 0.12 }} />
                    <polygon points={c.g.side} style={{ fill: `var(--car-${c.n}-side)` }} />
                    <polygon points={c.g.front} style={{ fill: `var(--car-${c.n}-front)` }} />
                    <polygon points={c.g.top} style={{ fill: `var(--car-${c.n}-top)` }} />
                    <polygon points={c.g.cside} style={{ fill: "var(--glass)" }} />
                    <polygon points={c.g.cfront} style={{ fill: "var(--glass)", opacity: 0.8 }} />
                    <polygon points={c.g.ctop} style={{ fill: `var(--car-${c.n}-top)` }} />
                    <ellipse cx="0" cy="0" rx="3.6" ry="3.6" transform={c.g.w1} style={{ fill: "var(--tyre)" }} />
                    <ellipse cx="0" cy="0" rx="3.6" ry="3.6" transform={c.g.w2} style={{ fill: "var(--tyre)" }} />
                    <circle cx={c.g.l1x} cy={c.g.l1y} r="1.7" style={{ fill: `var(--car-${c.n}-light)` }} />
                    <circle cx={c.g.l2x} cy={c.g.l2y} r="1.7" style={{ fill: `var(--car-${c.n}-light)` }} />
                  </g>
                </g>
              ))}
              {G.items.map((it) =>
                it.kind === "tree" ? (
                  <g key={it.key} aria-hidden="true">
                    <path d={it.trunk} style={{ stroke: "var(--trunk)", strokeWidth: 3.5, strokeLinecap: "round" }} />
                    <circle cx={it.x} cy={it.cy} r={it.r} style={{ fill: "var(--tree)" }} />
                    <circle cx={it.x2} cy={it.cy2} r={it.r2} style={{ fill: "var(--tree-2)" }} />
                  </g>
                ) : (
                  <g
                    key={it.id}
                    className={`house ${view.houseCls(it.id)}`}
                    style={{ animationDelay: `${view.candIdx[it.id] === undefined ? 0 : view.candIdx[it.id] * 520 + 1700}ms` }}
                    role="button"
                    tabIndex={0}
                    aria-label={it.aria}
                    onClick={() => pickRef.current(it.id, false)}
                    onKeyDown={onKey(it.id)}
                  >
                    <polygon className="lf" points={it.left} />
                    <polygon className="rt" points={it.right} />
                    <polygon className="roof" points={it.top} />
                    <polygon className="par" points={it.par} />
                    <polygon className="win" points={it.w1} />
                    <polygon className="win" points={it.w2} />
                    <polygon className="win" points={it.w3} />
                    <polygon className="door" points={it.door} />
                    <polygon className="tk" points={it.tkL} />
                    <polygon className="tk" points={it.tkR} style={{ opacity: 0.75 }} />
                    <polygon points={it.tkT} style={{ fill: "var(--ink-3)" }} />
                  </g>
                ),
              )}
              {!home && (
                <g aria-hidden="true" style={{ pointerEvents: "none" }}>
                  <ellipse className="idle-hint" cx={hint.rcx} cy={hint.rcy} rx="46" ry="23" style={{ fill: "none", stroke: "var(--m-str)", strokeWidth: 3 }} />
                  <g transform={`translate(${hint.rcx} ${hint.rcy - 22})`}>
                    <g className="tap">
                      <path d="M0 0 C-12 -16 -16 -22 -16 -30 A16 16 0 0 1 16 -30 C16 -22 12 -16 0 0Z" style={{ fill: "var(--m)", stroke: "var(--hard)", strokeWidth: 2 }} />
                      <circle cx="0" cy="-30" r="6" style={{ fill: "var(--on-m)" }} />
                    </g>
                  </g>
                </g>
              )}
              {view.cands.map((c) => (
                <g key={"m" + c.id} transform={`translate(${c.cx} ${c.my})`} aria-hidden="true" style={{ pointerEvents: "none" }}>
                  <g className="mark" style={{ transitionDelay: `${c.d1}ms` }}>
                    <circle r="13" style={{ fill: "var(--surface)", stroke: "var(--m-str)", strokeWidth: 2.5 }} />
                    <path d="M-4.5 -2a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0M3 1.5l4 4" style={{ fill: "none", stroke: "var(--m-str)", strokeWidth: 2.2, strokeLinecap: "round" }} />
                  </g>
                </g>
              ))}
              {view.cands.map((c) => (
                <g key={"e" + c.id} aria-hidden="true" style={{ pointerEvents: "none" }}>
                  <path className="arc" d={c.arc} style={{ strokeDasharray: c.len, strokeDashoffset: c.off, transitionDelay: `${c.d2}ms` }} />
                  <g transform={`translate(${view.hp.x} ${view.hp.y})`}>
                    <g className="fx" style={{ transform: `translateX(${c.tx}px)`, transitionDuration: "1700ms", transitionDelay: `${c.d2}ms` }}>
                      <g className="fy" style={{ transform: `translateY(${c.ty}px)`, transitionDuration: "1700ms", transitionDelay: `${c.d2}ms` }}>
                        <g className={`env ${c.ok ? "ok" : ""}`} style={{ transitionDelay: `${c.d2}ms` }}>
                          <rect x="-18" y="-13" width="36" height="26" rx="5" style={{ fill: "var(--surface)", stroke: "var(--m-str)", strokeWidth: 2.5 }} />
                          <path d="M-14 -8.5 0 2 14 -8.5" style={{ fill: "none", stroke: "var(--m-str)", strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }} />
                        </g>
                      </g>
                    </g>
                  </g>
                </g>
              ))}
              {view.yesList.map((y) => (
                <g key={"y" + y.id} aria-hidden="true" style={{ pointerEvents: "none" }}>
                  <ellipse className="ring" cx={y.gx} cy={y.gy} rx="40" ry="20" />
                  <ellipse className="ring b" cx={y.gx} cy={y.gy} rx="40" ry="20" />
                  <path className="ret-under" d={y.ret} style={{ strokeDasharray: y.len, strokeDashoffset: y.off, transitionDelay: `${y.d}ms` }} />
                  <path className="ret" d={y.ret} style={{ strokeDasharray: y.len, strokeDashoffset: y.off, transitionDelay: `${y.d}ms` }} />
                  <g transform={`translate(${y.sx} ${y.sy})`}>
                    <g className="fx" style={{ transform: `translateX(${y.tx}px)`, transitionDuration: "2000ms", transitionDelay: `${y.d}ms` }}>
                      <g className="fy" style={{ transform: `translateY(${y.ty}px)`, transitionDuration: "2000ms", transitionDelay: `${y.d}ms` }}>
                        <g className="lchip" style={{ transitionDelay: `${y.d}ms` }}>
                          <rect x="-40" y="-16" width="80" height="32" rx="16" style={{ fill: "var(--m)", stroke: "var(--hard)", strokeWidth: 2 }} />
                          <circle cx="-24" cy="0" r="10" style={{ fill: "var(--on-m)" }} />
                          <path d="M-28 -1.5a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M-31 8a7 7 0 0 1 14 0" style={{ fill: "var(--m)" }} />
                          <text x="8" y="5" textAnchor="middle" style={{ font: "800 13px var(--font-sans)", letterSpacing: ".06em", fill: "var(--on-m)" }}>
                            LEAD
                          </text>
                        </g>
                      </g>
                    </g>
                  </g>
                </g>
              ))}
              {home && (
                <g aria-hidden="true" style={{ pointerEvents: "none" }}>
                  <g transform={`translate(${home.rcx} ${home.rcy - 40})`}>
                    <g className="pinmk">
                      <g className="bob">
                        <path d="M0 0 C-15 -20 -20 -27 -20 -37 A20 20 0 0 1 20 -37 C20 -27 15 -20 0 0Z" style={{ fill: "var(--m)", stroke: "var(--hard)", strokeWidth: 2.5 }} />
                        <path d="M-8 -36 0 -43 8 -36V-28H-8z" style={{ fill: "var(--on-m)" }} />
                      </g>
                    </g>
                  </g>
                  <g transform={`translate(${home.rcx - 44} ${home.rcy - 52})`}>
                    <g className="badge">
                      <circle r="21" style={{ fill: "var(--surface)", stroke: "var(--m-str)", strokeWidth: 3.5 }} />
                      <text x="0" y="6" textAnchor="middle" style={{ font: "800 17px var(--font-sans)", fill: "var(--ink)" }}>
                        +2
                      </text>
                    </g>
                  </g>
                  <g transform={`translate(${home.rcx} ${home.rcy - 40})`}>
                    <g className="stamp">
                      <rect x="-62" y="-24" width="124" height="48" rx="8" style={{ fill: "var(--m)", stroke: "var(--hard)", strokeWidth: 4 }} />
                      <rect x="-55" y="-17" width="110" height="34" rx="4" style={{ fill: "none", stroke: "var(--hard)", strokeWidth: 1.6 }} />
                      <text x="0" y="9" textAnchor="middle" style={{ font: "900 26px var(--font-sans)", letterSpacing: ".14em", fill: "var(--ink)" }}>
                        SOLD
                      </text>
                    </g>
                  </g>
                </g>
              )}
              {G.confetti.map((p, n) => (
                <rect key={n} className={`cf ${p.k}`} x={p.x} y={p.y} width="9" height="5" rx="1.2" style={{ fill: p.fill, animationDelay: `${p.d}ms` }} aria-hidden="true" />
              ))}
            </g>
          </svg>
          <div className="ov" aria-hidden="true">
            {view.yesList.map((y) => (
              <div key={"b" + y.id} className="pin" style={{ left: y.left, top: y.top }}>
                <div className="hb" style={{ transitionDelay: `${y.bd}ms` }}>
                  <div className="bt">
                    <svg width="50%" height="50%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="ov" aria-hidden="true">
          <div className="status">
            <span className="chip" style={{ boxShadow: "var(--shadow)", fontWeight: 700, fontSize: 15 }}>
              <i />
              {statusText}
            </span>
          </div>
        </div>
      </div>
      <div className={`tray ${sceneCls}`} aria-hidden="true">
        <div className="tray-h">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
              <path d="M3 13l3-8h12l3 8v6H3z M3 13h5l1.5 2.5h5L16 13h5" />
            </svg>
            Your LEADS inbox
          </span>
          <span className="mono tcount">{trayCount}</span>
        </div>
        <div className="slots">
          {TOASTS.map((t) => (
            <div key={t.ini} className="slot">
              <span>Waiting for a reply…</span>
              <div className="toast" style={{ transitionDelay: `${t.d}ms` }}>
                <span className="av">{t.ini}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>{t.name}</span>
                    <span className="mono nl-tag">NEW LEAD</span>
                  </div>
                  <div className="said">{t.said}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
        <div style={{ display: "flex", gap: 6 }} aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="seg">
              <span style={{ width: step >= n ? "100%" : "0%", transitionDuration: `${step === n ? DURATIONS[n] : 0}ms` }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <p aria-live="polite" style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 12, fontSize: "clamp(16px,1.4vw,20px)", fontWeight: 600, letterSpacing: "-.02em" }}>
            <span className="mono" style={{ fontSize: 13, color: "var(--m-ink)", fontWeight: 600 }}>
              {capStep === 0 ? "START" : `0${capStep} / 06`}
            </span>
            <span>{CAPTIONS[capStep]}</span>
          </p>
          <button type="button" className="btn b-sm np" onClick={() => pickRef.current(s.home ?? G.defaultHome, false)}>
            {home ? (step >= 7 ? "Play again" : "Restart") : "Play the story"}
          </button>
        </div>
      </div>
    </div>
  );
}
