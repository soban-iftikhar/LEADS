"use client";

import { useEffect, useId, useRef } from "react";
import { readTheme, writeTheme, type Theme } from "@/lib/theme";
import { useTheme } from "@/lib/useTheme";

type Props = {
  /** Called after the theme flips (Ghar uses it to comment on the lights). */
  onToggle?: (theme: Theme) => void;
};

/**
 * Pendant lamp with a pull cord. Tap, Enter/Space, or drag the bead down more than 10px to flip
 * the theme. A 4–10px drag does nothing, like a real cord.
 */
export function LampToggle({ onToggle }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const theme = useTheme();
  const glowId = useId().replace(/:/g, "") + "lampGlow";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pull = el.querySelector<SVGGElement>(".pull");
    const sw = el.querySelector<SVGGElement>(".sw");
    if (!pull || !sw) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let st: { y0: number; dy: number } | null = null;

    const flip = () => {
      const next: Theme = readTheme() === "dark" ? "light" : "dark";
      writeTheme(next);
      onToggle?.(next);
    };

    const release = (dy: number) => {
      pull.style.transform = "";
      if (!reduce && typeof sw.animate === "function") {
        if (dy < 4) {
          pull.animate(
            [
              { transform: "translateY(0)" },
              { transform: "translateY(18px)", offset: 0.3 },
              { transform: "translateY(-4px)", offset: 0.7 },
              { transform: "translateY(0)" },
            ],
            { duration: 650, easing: "ease-out" },
          );
        }
        sw.animate(
          [
            { transform: "rotate(0)" },
            { transform: "rotate(11deg)" },
            { transform: "rotate(-8deg)" },
            { transform: "rotate(5deg)" },
            { transform: "rotate(-2deg)" },
            { transform: "rotate(0)" },
          ],
          { duration: 1500, easing: "ease-out" },
        );
      }
      if (dy < 4 || dy > 10) flip();
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      st = { y0: e.clientY, dy: 0 };
      el.classList.add("drag");
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // capture can fail on synthetic events; dragging still works without it
      }
    };
    const move = (e: PointerEvent) => {
      if (!st) return;
      st.dy = Math.max(0, Math.min(34, e.clientY - st.y0));
      pull.style.transform = `translateY(${st.dy}px)`;
    };
    const up = () => {
      if (!st) return;
      const dy = st.dy;
      st = null;
      el.classList.remove("drag");
      release(dy);
    };
    const cancel = () => {
      st = null;
      el.classList.remove("drag");
      pull.style.transform = "";
    };
    // Keyboard activation fires click with detail 0; pointer clicks are handled by pointerup.
    const click = (e: MouseEvent) => {
      if (e.detail === 0) release(0);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("click", click);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
      el.removeEventListener("click", click);
    };
  }, [onToggle]);

  const dark = theme === "dark";
  return (
    <button
      ref={ref}
      type="button"
      className="lamp"
      aria-label={dark ? "Pull the lamp cord: switch to light mode" : "Pull the lamp cord: switch to dark mode"}
      aria-pressed={dark}
      title="Pull the cord"
    >
      <svg viewBox="0 0 46 96" aria-hidden="true">
        <defs>
          <radialGradient id={glowId}>
            <stop offset="0" stopColor="var(--m-h)" stopOpacity=".85" />
            <stop offset="1" stopColor="var(--m-h)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="sw">
          <path d="M23 0V22" style={{ stroke: "var(--ink-3)", strokeWidth: 1.6 }} />
          <rect x="18.5" y="17" width="9" height="7" rx="2" style={{ fill: "var(--ink)" }} />
          <circle className="glow" cx="23" cy="40" r="22" fill={`url(#${glowId})`} />
          <circle className="bulb" cx="23" cy="39" r="6.2" strokeWidth="1.5" />
          <path
            d="M7 38.5C7 28.5 13.5 23 23 23s16 5.5 16 15.5z"
            style={{ fill: "var(--m)", stroke: "var(--hard)", strokeWidth: 2, strokeLinejoin: "round" }}
          />
          <path
            d="M12 33.5c2-4.5 5.5-6.5 9-7"
            style={{ fill: "none", stroke: "white", strokeWidth: 2, strokeLinecap: "round", opacity: 0.6 }}
          />
          <g className="pull">
            <path
              d="M34 37V70"
              style={{ stroke: "var(--ink-3)", strokeWidth: 1.7, strokeDasharray: "2 2.6", strokeLinecap: "round" }}
            />
            <path
              className="bead"
              d="M34 70c-3.4 0-5 2.6-5 5.4 0 2.6 2.2 4.6 5 4.6s5-2 5-4.6c0-2.8-1.6-5.4-5-5.4z"
              style={{ fill: "var(--m)", stroke: "var(--hard)", strokeWidth: 1.6 }}
            />
            <text
              className="hint"
              x="42"
              y="90"
              style={{ font: "600 8.5px var(--font-mono)", fill: "var(--ink-3)", letterSpacing: ".04em" }}
            >
              pull
            </text>
          </g>
        </g>
      </svg>
    </button>
  );
}
