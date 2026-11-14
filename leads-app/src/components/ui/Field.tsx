"use client";

import { cloneElement, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** Right side of the label row (e.g. "Forgot password?"). */
  aside?: ReactNode;
  children: ReactElement<{ id?: string; invalid?: boolean; describedBy?: string }>;
  className?: string;
};

/** Label + control + hint/error. Wires id, aria-invalid and aria-describedby into the child. */
export function Field({ label, hint, error, aside, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-h`;
  const errId = `${id}-e`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children) ? cloneElement(children, { id, invalid: !!error, describedBy }) : children;
  return (
    <div className={cx("field", className)}>
      <div className="lbl-row">
        <label className="lbl" htmlFor={id}>
          {label}
        </label>
        {aside}
      </div>
      {control}
      {hint && !error && (
        <div className="hint" id={hintId}>
          {hint}
        </div>
      )}
      {error && (
        <div className="etx" id={errId} role="alert">
          <Icon name="alert" size={15} />
          {error}
        </div>
      )}
    </div>
  );
}

type Wired = { id?: string; invalid?: boolean; describedBy?: string };

export function TextInput({
  prefix,
  suffix,
  invalid,
  describedBy,
  className,
  ...rest
}: Wired & Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & { prefix?: ReactNode; suffix?: ReactNode }) {
  return (
    <div className={cx("inp", invalid && "bad", className)}>
      {prefix && <span className="pre">{prefix}</span>}
      <input {...rest} aria-invalid={invalid || undefined} aria-describedby={describedBy} />
      {suffix && <span className="suf">{suffix}</span>}
    </div>
  );
}

export function Textarea({ invalid, describedBy, className, ...rest }: Wired & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx("ta", invalid && "bad", className)} aria-invalid={invalid || undefined} aria-describedby={describedBy} />;
}

export function Select({
  invalid,
  describedBy,
  className,
  children,
  ...rest
}: Wired & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx("inp", "selwrap", invalid && "bad", className)}>
      <select {...rest} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
        {children}
      </select>
      <span className="suf" aria-hidden="true">
        <Icon name="chevd" size={16} />
      </span>
    </div>
  );
}
