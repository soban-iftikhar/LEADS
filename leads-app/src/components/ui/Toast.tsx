"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastFn = (text: string) => void;
const Ctx = createContext<ToastFn>(() => {});

/** Toasts: ink pill, 4 seconds, bottom-left on desktop and bottom-centre on mobile. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  const seq = useRef(0);
  const show = useCallback<ToastFn>((text) => {
    const id = ++seq.current;
    setItems((t) => [...t, { id, text }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast-i">
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastFn {
  return useContext(Ctx);
}
