import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";
import type { IconName } from "./icons";

export function Note({ tone, icon, children, className, role }: { tone?: "warn" | "y"; icon?: IconName; children: ReactNode; className?: string; role?: "alert" | "status" }) {
  return (
    <div className={cx("note", tone, className)} role={role}>
      {icon && <Icon name={icon} size={18} className="note-ic" />}
      <div className="note-b">{children}</div>
    </div>
  );
}
