"use client";

import { useCallback, useSyncExternalStore } from "react";

// Collapsed lives on <html data-rail="col"> so the pre-paint script (lib/theme.ts) can set it
// before the first frame. Each shell remembers its own choice under its own storage key.
const RAIL_EVENT = "leads-rail";
const read = () => document.documentElement.getAttribute("data-rail") === "col";
const subscribe = (cb: () => void) => {
  window.addEventListener(RAIL_EVENT, cb);
  return () => window.removeEventListener(RAIL_EVENT, cb);
};

export function useRailCollapsed(storageKey: string) {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const setCollapsed = useCallback(
    (col: boolean) => {
      if (col) document.documentElement.setAttribute("data-rail", "col");
      else document.documentElement.removeAttribute("data-rail");
      try {
        localStorage.setItem(storageKey, col ? "col" : "open");
      } catch {
        // storage blocked: the choice lasts for this page only
      }
      window.dispatchEvent(new Event(RAIL_EVENT));
    },
    [storageKey],
  );
  const toggle = useCallback(() => setCollapsed(!read()), [setCollapsed]);
  return { collapsed, setCollapsed, toggle };
}
