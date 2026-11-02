/** Key used by the lamp switch and the pre-paint script. */
export const THEME_STORAGE_KEY = "leads-theme";

export type Theme = "light" | "dark";

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme.
 * Saved choice wins, then the OS preference, then light.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='dark'&&t!=='light'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}})();`;

export function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function writeTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage blocked (private mode): the theme still applies for this page
  }
  window.dispatchEvent(new CustomEvent("leads-theme", { detail: theme }));
}

