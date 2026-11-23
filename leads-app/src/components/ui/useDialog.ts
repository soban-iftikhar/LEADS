"use client";

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

const noop = () => () => {};
// portal out of the page pane: its transition (filter/transform) would trap position:fixed,
// but stay inside the surface root so its scoped styles apply
const portalHost = () => document.querySelector<HTMLElement>(".app-ui, .adm") ?? document.body;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Shared by Modal, Drawer and ConfirmDialog: where to portal, focus moved in and trapped,
 * Esc closes, page scroll locked, and focus returned to the trigger on close.
 */
export function useDialog(panel: RefObject<HTMLElement | null>, onClose: () => void): HTMLElement | null {
  const host = useSyncExternalStore(noop, portalHost, () => null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!host) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = panel.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((n) => !n.hasAttribute("aria-hidden"));
    (el?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [host, panel]);

  return host;
}
