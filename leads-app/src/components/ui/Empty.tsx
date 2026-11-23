import type { ReactNode } from "react";

/** Dashed house outline: the "nothing here yet" picture. */
function HouseOutline() {
  return (
    <svg className="empty-art" width="56" height="44" viewBox="0 0 64 48" aria-hidden="true">
      <path d="M6 42h52" stroke="var(--line-2)" strokeWidth="2" />
      <path d="M20 24 32 14l12 10v18H20z" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeDasharray="4 4" />
    </svg>
  );
}

export function Empty({ children, action, title, art }: { children: ReactNode; action?: ReactNode; title?: string; art?: "house" }) {
  return (
    <div className="empty">
      {art === "house" && <HouseOutline />}
      {title && <b className="empty-h">{title}</b>}
      <p className="empty-t">{children}</p>
      {action && <div className="empty-a">{action}</div>}
    </div>
  );
}
