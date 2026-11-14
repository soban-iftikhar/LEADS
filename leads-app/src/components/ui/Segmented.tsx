"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent } from "react";
import { cx } from "./cx";

export type SegItem<V extends string> = { value: V; label: string; count?: number; href?: string };

type Props<V extends string> = {
  items: SegItem<V>[];
  value: V;
  onChange?: (v: V) => void;
  label: string;
  className?: string;
};

/** Pill tabs for filters and type pickers. Arrow keys move between tabs. */
export function Segmented<V extends string>({ items, value, onChange, label, className }: Props<V>) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    const tabs = Array.from(ref.current?.querySelectorAll<HTMLElement>("[role=tab]") ?? []);
    const i = tabs.findIndex((t) => t === document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const n =
      e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[n]?.focus();
    tabs[n]?.click();
  };
  return (
    <div ref={ref} className={cx("seg", className)} role="tablist" aria-label={label} onKeyDown={onKey}>
      {items.map((it) => {
        const on = it.value === value;
        const inner = (
          <>
            {it.label}
            {it.count !== undefined && <span className="n">{it.count}</span>}
          </>
        );
        const common = {
          role: "tab" as const,
          "aria-selected": on,
          tabIndex: on ? 0 : -1,
          className: on ? "on" : undefined,
        };
        return it.href ? (
          <Link key={it.value} href={it.href} scroll={false} {...common} onClick={() => onChange?.(it.value)}>
            {inner}
          </Link>
        ) : (
          <button key={it.value} type="button" {...common} onClick={() => onChange?.(it.value)}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}
