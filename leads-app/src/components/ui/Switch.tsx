"use client";

import { cx } from "./cx";

type Props = { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean; id?: string };

export function Switch({ checked, onChange, label, disabled, id }: Props) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cx("tog", checked && "on")}
      onClick={() => onChange(!checked)}
    />
  );
}
