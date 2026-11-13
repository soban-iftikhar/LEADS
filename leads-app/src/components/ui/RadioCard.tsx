"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

type Props = {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
};

/** A whole-card radio. Uses a native radio so arrow keys and forms work. */
export function RadioCard({ name, value, checked, onChange, children, disabled, className }: Props) {
  return (
    <label className={cx("radio", checked && "on", disabled && "is-disabled", className)}>
      <input
        type="radio"
        className="sr-only"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
      />
      <span className="rd" aria-hidden="true" />
      <span className="radio-body">{children}</span>
    </label>
  );
}
