"use client";

import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "./useDialog";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

/** Dialog with focus trap; Esc and the overlay close it and focus returns to the trigger. */
export function Modal({ title, onClose, children, footer }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const host = useDialog(panel, onClose);

  if (!host) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="sec-h">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="mini" aria-label="Close" onClick={onClose}>
            <svg className="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="sec-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>,
    host,
  );
}
