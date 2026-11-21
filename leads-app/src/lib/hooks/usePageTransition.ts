"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

type Options = {
  /** Numbers inside these elements count up from 0 when a page arrives. */
  countSelector: string;
  countMs?: number;
  /** How long the old page fades out before the route swaps. */
  leaveMs?: number;
};

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// "1,20,000" keeps its grouping while it counts; Pakistani grouping, same as groupPk().
const group = (n: number, decimals: number, commas: boolean) =>
  commas ? n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : n.toFixed(decimals);

function countUp(root: HTMLElement | null, selector: string, ms: number) {
  if (!root || reducedMotion()) return;
  root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const node = el.firstChild;
    if (!node || node.nodeType !== 3) return;
    const m = (node.nodeValue ?? "").match(/^(\D*?)(\d[\d,]*)(?:\.(\d+))?([\s\S]*)$/);
    if (!m) return;
    const [, pre, whole, frac = "", post] = m;
    const end = Number(`${whole.replace(/,/g, "")}.${frac || "0"}`);
    const commas = whole.includes(",");
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      node.nodeValue = pre + group(end * e, frac.length, commas) + post;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/**
 * The page transition shared by the customer app and the admin: the old page fades out, the
 * route swaps, the new page's blocks rise in (CSS on the pane) and its numbers count up.
 * Every same-site link inside the shell gets it, not only the menu.
 */
export function usePageTransition({ countSelector, countMs = 800, leaveMs = 190 }: Options) {
  const path = usePathname();
  const router = useRouter();
  // the path we are leaving; the page is faded out only while we are still on it
  const [leaving, setLeaving] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback(
    (href: string) => {
      const target = new URL(href, window.location.href);
      if (target.pathname === window.location.pathname) {
        router.push(target.pathname + target.search + target.hash);
        return;
      }
      if (busy.current) return;
      if (reducedMotion()) {
        router.push(href);
        return;
      }
      busy.current = true;
      setLeaving(window.location.pathname);
      timer.current = setTimeout(() => router.push(href), leaveMs);
    },
    [router, leaveMs],
  );

  // the new route has rendered: show it, scroll up, count the numbers up
  useEffect(() => {
    busy.current = false;
    if (timer.current) clearTimeout(timer.current);
    window.scrollTo({ top: 0 });
    const r = requestAnimationFrame(() => countUp(stage.current, countSelector, countMs));
    return () => cancelAnimationFrame(r);
  }, [path, countSelector, countMs]);

  const onClickCapture = (e: MouseEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || a.target || a.hasAttribute("download")) return;
    const href = a.getAttribute("href") ?? "";
    if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/api/")) return;
    const url = new URL(href, window.location.href);
    if (url.pathname === window.location.pathname) return; // filters and anchors: let Link handle it
    e.preventDefault();
    go(href);
  };

  return { path, out: leaving === path, go, stage, onClickCapture };
}
