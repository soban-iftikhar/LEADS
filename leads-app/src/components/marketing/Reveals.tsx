"use client";

import { useEffect } from "react";

/**
 * Scroll reveals for the landing. Server-rendered sections carry `data-rv="<key>"` on the element
 * that triggers and `data-rv-group="<key>"` on everything that animates with it. Without JS the
 * content simply shows; with JS we arm the page and add `in` as each group scrolls into view.
 */
export function Reveals({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("armed");
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          io.unobserve(en.target);
          const key = en.target.getAttribute("data-rv");
          if (!key) continue;
          root.querySelectorAll(`[data-rv-group="${key}"]`).forEach((el) => el.classList.add("in"));
          if (key === "price") {
            setTimeout(() => window.dispatchEvent(new CustomEvent("ghar-say", { detail: "Psst… listing is free. You only pay for buyers." })), 900);
          }
        }
      },
      { threshold: 0.15 },
    );
    root.querySelectorAll("[data-rv]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rootId]);
  return null;
}
