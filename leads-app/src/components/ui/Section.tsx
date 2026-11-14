import type { ReactNode } from "react";
import { cx } from "./cx";

type Props = {
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  /** Tables sit edge to edge: no body padding. */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  id?: string;
  as?: "section" | "div";
  labelledBy?: string;
};

/** The layout block: card with an optional header row and a padded body. */
export function Section({ title, action, children, flush, className, bodyClassName, id, as = "section" }: Props) {
  const Tag = as;
  return (
    <Tag className={cx("sec", className)} id={id}>
      {(title || action) && (
        <div className="sec-h">
          {typeof title === "string" ? <h2>{title}</h2> : title}
          {action}
        </div>
      )}
      {children !== undefined && (flush ? children : <div className={cx("sec-b", bodyClassName)}>{children}</div>)}
    </Tag>
  );
}
