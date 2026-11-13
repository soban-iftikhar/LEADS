"use client";

import { useSyncExternalStore } from "react";
import { readTheme, type Theme } from "./theme";

const subscribe = (cb: () => void) => {
  window.addEventListener("leads-theme", cb);
  return () => window.removeEventListener("leads-theme", cb);
};

/** Current theme, kept in sync with the lamp. Light on the server. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "light");
}
