"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

export function Checkbox({ children, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { children: ReactNode }) {
  return (
    <label className="chk">
      <input type="checkbox" className="sr-only chk-in" {...rest} />
      <span className="bx" aria-hidden="true">
        <Icon name="check" size={14} strokeWidth={3.2} />
      </span>
      {children}
    </label>
  );
}
