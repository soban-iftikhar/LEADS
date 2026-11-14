// Geometry for the isometric neighbourhood on the landing page (7 x 5 tiles).
// Everything is computed once; the story only toggles classes on top of it.

type Pt = [number, number];

const f = (pts: Pt[]) => pts.map((q) => q[0].toFixed(1) + "," + q[1].toFixed(1)).join(" ");

export type CarShape = {
  side: string;
  front: string;
  top: string;
  cside: string;
  cfront: string;
  ctop: string;
  w1: string;
  w2: string;
  l1x: string;
  l1y: string;
  l2x: string;
  l2y: string;
};

function isoCar(U: Pt, V: Pt): CarShape {
  const L = 30, Wd = 15, h0 = 3, hb = 9, cl = 15, cw = 13, hc = 7, co = -3;
  const P = (a: number, b: number, hh: number): Pt => [a * U[0] + b * V[0], a * U[1] + b * V[1] - hh];
  const top = (a0: number, a1: number, b0: number, b1: number, hh: number) => f([P(a0, b0, hh), P(a1, b0, hh), P(a1, b1, hh), P(a0, b1, hh)]);
  const wheel = (a: number) => {
    const p = P(a, Wd / 2, 3.6);
    return `matrix(${U[0]} ${U[1]} 0 1 ${p[0].toFixed(1)} ${p[1].toFixed(1)})`;
  };
  const l1 = P(L / 2, -Wd * 0.3, h0 + hb * 0.55);
  const l2 = P(L / 2, Wd * 0.3, h0 + hb * 0.55);
  return {
    side: f([P(-L / 2, Wd / 2, h0), P(L / 2, Wd / 2, h0), P(L / 2, Wd / 2, h0 + hb), P(-L / 2, Wd / 2, h0 + hb)]),
    front: f([P(L / 2, -Wd / 2, h0), P(L / 2, Wd / 2, h0), P(L / 2, Wd / 2, h0 + hb), P(L / 2, -Wd / 2, h0 + hb)]),
    top: top(-L / 2, L / 2, -Wd / 2, Wd / 2, h0 + hb),
    cside: f([P(co - cl / 2, cw / 2, h0 + hb), P(co + cl / 2, cw / 2, h0 + hb), P(co + cl / 2 - 2, cw / 2, h0 + hb + hc), P(co - cl / 2 + 1, cw / 2, h0 + hb + hc)]),
    cfront: f([P(co + cl / 2, -cw / 2, h0 + hb), P(co + cl / 2, cw / 2, h0 + hb), P(co + cl / 2 - 2, cw / 2, h0 + hb + hc), P(co + cl / 2 - 2, -cw / 2, h0 + hb + hc)]),
    ctop: top(co - cl / 2 + 1, co + cl / 2 - 2, -cw / 2, cw / 2, h0 + hb + hc),
    w1: wheel(-L * 0.3),
    w2: wheel(L * 0.3),
    l1x: l1[0].toFixed(1),
    l1y: l1[1].toFixed(1),
    l2x: l2[0].toFixed(1),
    l2y: l2[1].toFixed(1),
  };
}

export type Tree = { kind: "tree"; key: string; depth: number; x: number; cy: number; r: number; x2: number; cy2: number; r2: number; trunk: string };

export type House = {
  kind: "house";
  id: string;
  depth: number;
  i: number;
  j: number;
  gx: number;
  gy: number;
  rcx: number;
  rcy: number;
  name: string;
  aria: string;
  left: string;
  right: string;
  top: string;
  par: string;
  w1: string;
  w2: string;
  w3: string;
  door: string;
  tkL: string;
  tkR: string;
  tkT: string;
};

export type Scene = {
  ground: string;
  slabL: string;
  slabR: string;
  roads: string[];
  parks: string[];
  dash: string;
  carI: CarShape;
  carJ: CarShape;
  items: (Tree | House)[];
  houses: House[];
  byId: Record<string, House>;
  defaultHome: string;
  confetti: { x: number; y: number; d: number; k: "a" | "b" | "c"; fill: string }[];
};

export function buildScene(): Scene {
  const ox = 540, oy = 200, HW = 60, HH = 30, Ni = 7, Nj = 5;
  const tc = (i: number, j: number) => ({ x: ox + (i - j) * HW, y: oy + (i + j + 1) * HH });
  const dia = (c: { x: number; y: number }, a: number, b: number): Pt[] => [
    [c.x, c.y - b],
    [c.x + a, c.y],
    [c.x, c.y + b],
    [c.x - a, c.y],
  ];
  const gN: Pt = [ox, oy];
  const gE: Pt = [ox + Ni * HW, oy + Ni * HH];
  const gS: Pt = [ox + (Ni - Nj) * HW, oy + (Ni + Nj) * HH];
  const gW: Pt = [ox - Nj * HW, oy + Nj * HH];
  const sl = 26;
  const roads: string[] = [];
  const parks: string[] = [];
  const isRoad = (i: number, j: number) => i === 3 || j === 2;
  const isPark = (i: number, j: number) => (i === 6 && j === 0) || (i === 0 && j === 4) || (i === 6 && j === 4);
  for (let i = 0; i < Ni; i++)
    for (let j = 0; j < Nj; j++) {
      if (isRoad(i, j)) roads.push(f(dia(tc(i, j), HW, HH)));
      else if (isPark(i, j)) parks.push(f(dia(tc(i, j), HW, HH)));
    }
  const a0 = tc(0, 2), a1 = tc(Ni - 1, 2), b0 = tc(3, 0), b1 = tc(3, Nj - 1);
  const dash = `M${a0.x - HW / 2} ${a0.y - HH / 2}L${a1.x + HW / 2} ${a1.y + HH / 2}M${b0.x + HW / 2} ${b0.y - HH / 2}L${b1.x - HW / 2} ${b1.y + HH / 2}`;
  const sizes = ["10 Marla", "1 Kanal", "8 Marla", "12 Marla", "7 Marla", "14 Marla"];
  const items: (Tree | House)[] = [];
  const houses: House[] = [];
  let k = 0;
  for (let i = 0; i < Ni; i++)
    for (let j = 0; j < Nj; j++) {
      const c = tc(i, j);
      const depth = i + j + i * 0.01;
      if (isRoad(i, j)) continue;
      if (isPark(i, j)) {
        ([[-22, -6, 17], [20, 2, 15], [0, 13, 12]] as const).forEach(([dx, dy, r], n) => {
          const x = c.x + dx, y = c.y + dy;
          items.push({ kind: "tree", key: `t${i}-${j}-${n}`, depth: depth + n * 0.001, x, cy: y - 26, r, x2: x + r * 0.35, cy2: y - 31, r2: r * 0.55, trunk: `M${x} ${y}V${y - 16}` });
        });
        continue;
      }
      const H = (i * 3 + j * 5) % 3 === 0 ? 84 : 60;
      const a = 44, b = 22;
      const W: Pt = [c.x - a, c.y], S: Pt = [c.x, c.y + b], E: Pt = [c.x + a, c.y], Nn: Pt = [c.x, c.y - b];
      const up = (p: Pt, hh: number): Pt => [p[0], p[1] - hh];
      const rc: Pt = [c.x, c.y - H];
      const sc = (p: Pt, s: number): Pt => [rc[0] + (p[0] - rc[0]) * s, rc[1] + (p[1] - rc[1]) * s];
      const fp = (A: Pt, B: Pt, t: number, vv: number): Pt => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - vv];
      const quad = (A: Pt, B: Pt, t0: number, t1: number, v0: number, v1: number) => f([fp(A, B, t0, v0), fp(A, B, t1, v0), fp(A, B, t1, v1), fp(A, B, t0, v1)]);
      const roofPts = [up(Nn, H), up(E, H), up(S, H), up(W, H)];
      const tcn = { x: c.x - 12, y: c.y - H - 6 }, ta = 9, tb = 4.5, th = 14;
      const tW: Pt = [tcn.x - ta, tcn.y], tS: Pt = [tcn.x, tcn.y + tb], tE: Pt = [tcn.x + ta, tcn.y], tN: Pt = [tcn.x, tcn.y - tb];
      const no = 3 + k * 3;
      const size = sizes[k % sizes.length];
      k++;
      const hs: House = {
        kind: "house",
        id: `${i}-${j}`,
        depth,
        i,
        j,
        gx: c.x,
        gy: c.y,
        rcx: rc[0],
        rcy: rc[1],
        name: `House ${no} · ${size}`,
        aria: `House ${no}, ${size}. Show how LEADS finds buyers for this house.`,
        left: f([W, S, up(S, H), up(W, H)]),
        right: f([S, E, up(E, H), up(S, H)]),
        top: f(roofPts),
        par: f(roofPts.map((p) => sc(p, 0.74))),
        w1: quad(W, S, 0.16, 0.42, H * 0.5, H * 0.8),
        w2: quad(W, S, 0.58, 0.84, H * 0.5, H * 0.8),
        w3: quad(S, E, 0.56, 0.84, H * 0.5, H * 0.8),
        door: quad(S, E, 0.14, 0.36, 0, H * 0.44),
        tkL: f([tW, tS, up(tS, th), up(tW, th)]),
        tkR: f([tS, tE, up(tE, th), up(tS, th)]),
        tkT: f([up(tN, th), up(tE, th), up(tS, th), up(tW, th)]),
      };
      items.push(hs);
      houses.push(hs);
    }
  items.sort((p, q) => p.depth - q.depth);
  const byId: Record<string, House> = {};
  houses.forEach((hs) => {
    byId[hs.id] = hs;
  });
  const fills = ["var(--m)", "var(--m-mid)", "var(--m-tint)"];
  return {
    ground: f([gN, gE, gS, gW]),
    slabL: f([gW, gS, [gS[0], gS[1] + sl], [gW[0], gW[1] + sl]]),
    slabR: f([gS, gE, [gE[0], gE[1] + sl], [gS[0], gS[1] + sl]]),
    roads,
    parks,
    dash,
    carI: isoCar([1, 0.5], [-1, 0.5]),
    carJ: isoCar([-1, 0.5], [1, 0.5]),
    items,
    houses,
    byId,
    defaultHome: "2-1",
    confetti: Array.from({ length: 24 }, (_, n) => ({
      x: 280 + ((n * 131) % 660),
      y: 80 + ((n * 53) % 120),
      d: n * 110,
      k: (["a", "b", "c"] as const)[n % 3],
      fill: fills[n % 3],
    })),
  };
}

/** Quadratic arc between two points with a length estimate for the dash draw-in. */
export function arc(p: { x: number; y: number }, q: { x: number; y: number }, lift: number) {
  const mx = (p.x + q.x) / 2;
  const my = Math.min(p.y, q.y) - lift;
  const len = Math.ceil(((Math.hypot(mx - p.x, my - p.y) + Math.hypot(q.x - mx, q.y - my) + Math.hypot(q.x - p.x, q.y - p.y)) / 2) * 1.08) + 6;
  return { d: `M${p.x.toFixed(1)} ${p.y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`, len };
}

/**
 * Places a check badge (in % of the stage) so its zoomed position stays clear of the edges,
 * the status chip (top-left) and the reply cards (top-right). `prev` avoids overlapping the first badge.
 */
export function keepIn(x: number, y: number, home: House, prev: { x: number; y: number } | null) {
  const z = 1.18, W = 8.5, H = 12.5;
  const ox = (home.rcx - 170) / 8.6, oy = (home.rcy - 30) / 5.8;
  let dx = ox + ((x - 170) / 8.6 - ox) * z;
  let dy = oy + ((y - 30) / 5.8 - oy) * z;
  const fit = () => {
    dx = Math.max(W / 2 + 1, Math.min(99 - W / 2, dx));
    let minY = H + 2;
    if (dx + W / 2 > 54) minY = Math.max(minY, 32 + H);
    if (dx - W / 2 < 27) minY = Math.max(minY, 12 + H);
    dy = Math.max(minY, Math.min(97, dy));
  };
  fit();
  if (prev && Math.abs(prev.x - dx) < W + 1 && Math.abs(prev.y - dy) < H + 1) {
    dx = prev.x + (prev.x > 80 ? -(W + 2) : W + 2);
    fit();
    if (Math.abs(prev.x - dx) < W + 1 && Math.abs(prev.y - dy) < H + 1) {
      dy = prev.y + H + 2;
      fit();
    }
  }
  const lx = ox + (dx - ox) / z;
  const ly = oy + (dy - oy) / z;
  return { pos: { x: dx, y: dy }, left: lx.toFixed(2) + "%", top: ly.toFixed(2) + "%" };
}

export const SCENE = buildScene();
export const LOOP_HOMES = ["2-1", "5-3", "1-3", "4-1", "6-3", "0-1"];
export const DURATIONS: Record<number, number> = { 1: 3800, 2: 4200, 3: 5600, 4: 5000, 5: 5000, 6: 6000 };
