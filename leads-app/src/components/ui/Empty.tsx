import type { ReactNode } from "react";

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-t">{children}</p>
      {action && <div className="empty-a">{action}</div>}
    </div>
  );
}
