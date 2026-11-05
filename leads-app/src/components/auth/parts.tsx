"use client";

import Link from "next/link";
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/** Log in | Create account switch at the top of the card. */
export function AuthTabs({ active }: { active: "login" | "signup" }) {
  return (
    <div className="tabs" role="tablist" aria-label="Log in or sign up">
      <Link className="tab" role="tab" aria-selected={active === "login"} href="/login">
        Log in
      </Link>
      <Link className="tab" role="tab" aria-selected={active === "signup"} href="/signup">
        Create account
      </Link>
    </div>
  );
}

const STEPS = ["Account type", "Your details", "Verify"];

export function Stepper({ step }: { step: 0 | 1 | 2 }) {
  return (
    <div className="stp" aria-label={`Step ${step + 1} of 3`}>
      {STEPS.map((label, i) => (
        <div key={label} className={i <= step ? "on" : ""} aria-current={i === step ? "step" : undefined}>
          <i />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function Banner({ children }: { children: ReactNode }) {
  return (
    <div className="banner" role="alert">
      <Icon name="alert" size={18} />
      <span>{children}</span>
    </div>
  );
}

export function QuietNote({ children }: { children: ReactNode }) {
  return (
    <div className="banner quiet" role="status">
      <Icon name="check" size={18} />
      <span>{children}</span>
    </div>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p className="etx" id={id}>
      <Icon name="alert" size={15} />
      {children}
    </p>
  );
}

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & { error?: string | null; prefix?: string; errorId?: string };

/** Auth-sized input box (58px). Shows the error ring and wires aria. */
export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(function AuthInput({ error, prefix, errorId, ...rest }, ref) {
  return (
    <div className={`inp ${error ? "bad" : ""}`}>
      {prefix && <span className="pre">{prefix}</span>}
      <input ref={ref} {...rest} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} />
    </div>
  );
});

/** Password box with show/hide eye. Ghar closes his eyes while a hidden password has focus. */
export const PasswordInput = forwardRef<HTMLInputElement, AuthInputProps>(function PasswordInput({ error, errorId, ...rest }, ref) {
  const [shown, setShown] = useState(false);
  return (
    <div className={`inp ${error ? "bad" : ""}`}>
      <input ref={ref} {...rest} type={shown ? "text" : "password"} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} />
      <button
        type="button"
        className="eyeb"
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShown((s) => !s)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {!shown && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  );
});

/** 0 empty · 1 too weak · 2 okay · 3 good · 4 strong. Needs 8+ chars and a number to pass. */
export function passwordStrength(v: string): 0 | 1 | 2 | 3 | 4 {
  if (!v) return 0;
  if (v.length < 8) return 1;
  let n = 1;
  if (/\d/.test(v)) n++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) n++;
  if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) n++;
  return Math.min(4, n) as 0 | 1 | 2 | 3 | 4;
}

const LABELS = ["", "Too weak", "Okay", "Good", "Strong"];

export function strengthLabel(level: number): string {
  return LABELS[level] ?? "";
}

export function StrengthMeter({ level }: { level: number }) {
  const col = level <= 1 ? "var(--err)" : level === 2 ? "var(--m-mid)" : level === 3 ? "var(--m)" : "var(--ink)";
  return (
    <div className="meter" aria-hidden="true">
      {[1, 2, 3, 4].map((n) => (
        <i key={n} className={n <= level ? "f" : ""} style={{ background: n <= level ? col : "var(--line)" }} />
      ))}
    </div>
  );
}

/** Shakes the card on a failed submit (skipped with reduced motion). */
export function shake(el: HTMLElement | null) {
  if (!el?.animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  el.animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-10px)" }, { transform: "translateX(9px)" }, { transform: "translateX(-6px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
    { duration: 480, easing: "ease-out" },
  );
}

export function Spinner() {
  return <span className="spin" aria-hidden="true" />;
}

/** Google's own "G" mark. Its colours follow Google's sign-in branding rules, not our palette. */
function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Full-width "Continue with Google" link (a navigation, not a fetch) with the "or" divider. */
export function GoogleButton({ href, label = "Continue with Google", dividerAfter = true }: { href: string; label?: string; dividerAfter?: boolean }) {
  return (
    <>
      <a href={href} className="btn full gbtn">
        <GoogleG />
        {label}
      </a>
      {dividerAfter && (
        <div className="or" role="separator">
          or
        </div>
      )}
    </>
  );
}
