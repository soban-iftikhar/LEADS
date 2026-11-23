"use client";

import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { useDialog } from "./useDialog";

type Props = {
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

/** Yes/no question before something that changes data. Cancel has focus first. */
export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onCancel, busy }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const textId = useId();
  const host = useDialog(panel, onCancel);

  if (!host) return null;
  return createPortal(
    <div className="scrim mid" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div ref={panel} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={textId}>
        <h2 id={titleId}>{title}</h2>
        <p id={textId}>{text}</p>
        <div className="dialog-a">
          <Button onClick={onCancel} data-autofocus>
            Cancel
          </Button>
          <Button variant="ink" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    host,
  );
}
