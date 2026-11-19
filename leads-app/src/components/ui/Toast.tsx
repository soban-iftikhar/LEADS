"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

type ToastOptions = { /** Shows an Undo button that runs this. */ undo?: () => void };
type ToastFn = (text: string, options?: ToastOptions) => void;
const Ctx = createContext<ToastFn>(() => {});

type Item = { id: number; text: string; undo?: () => void };

/**
 * Toasts: ink pill with a check mark, optional Undo. Placement comes from the surface's CSS
 * (bottom-left in the app, bottom-centre in admin). `duration` in ms.
 */
export function ToastProvider({ children, duration = 4000 }: { children: ReactNode; duration?: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback<ToastFn>(
    (text, options) => {
      const id = ++seq.current;
      setItems((t) => [...t, { id, text, undo: options?.undo }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss, duration],
  );
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast-i">
            <span className="toast-ok" aria-hidden="true">
              <Icon name="check" size={13} strokeWidth={3} />
            </span>
            {t.text}
            {t.undo && (
              <button
                type="button"
                className="toast-undo"
                onClick={() => {
                  dismiss(t.id);
                  t.undo?.();
                }}
              >
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastFn {
  return useContext(Ctx);
}
