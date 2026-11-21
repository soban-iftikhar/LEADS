"use client";

import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { useDialog } from "./useDialog";

type Props = {
  title: string;
  /** Small line under the title. */
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

/** Panel from the right edge for details and forms. Focus trapped; Esc and the scrim close it. */
export function Drawer({ title, sub, onClose, children, footer }: Props) {
  const panel = useRef<HTMLElement>(null);
  const titleId = useId();
  const host = useDialog(panel, onClose);

  if (!host) return null;
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside ref={panel} className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="ch">
          <div>
            <h2 id={titleId}>{title}</h2>
            {sub && <span className="m">{sub}</span>}
          </div>
          <button className="ib sm ghost" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="dbody">{children}</div>
        {footer && <div className="dfoot">{footer}</div>}
      </aside>
    </div>,
    host,
  );
}
