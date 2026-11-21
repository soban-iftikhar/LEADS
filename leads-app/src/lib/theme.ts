/** Key used by the lamp switch and the pre-paint script. */
export const THEME_STORAGE_KEY = "leads-theme";

export type Theme = "light" | "dark";

/** Collapsed rail is remembered here ("col") and applied before paint like the theme. */
export const RAIL_STORAGE_KEY = "leads-rail";

/** The admin rail remembers its own state. */
export const ADMIN_RAIL_STORAGE_KEY = "leads-admin-rail";

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme.
 * Saved choice wins, then the OS preference, then light.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='dark'&&t!=='light'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t);var rk=location.pathname.indexOf('/admin')===0?'${ADMIN_RAIL_STORAGE_KEY}':'${RAIL_STORAGE_KEY}';if(localStorage.getItem(rk)==='col')document.documentElement.setAttribute('data-rail','col')}catch(e){document.documentElement.setAttribute('data-theme','light')}})();`;

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

