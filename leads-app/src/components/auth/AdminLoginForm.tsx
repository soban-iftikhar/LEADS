"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ApiError, adminLogin, adminSecondStep } from "@/lib/api";
import { AuthInput, Banner, FieldError, PasswordInput, shake, Spinner } from "./parts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "password" | "code";

/** Admin sign-in (DR-38): email and password, then the 6-digit authenticator code. */
export function AdminLoginForm({ next, startAt }: { next: string; startAt: Step }) {
  const router = useRouter();
  const card = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>(startAt);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<{ field?: "email" | "pw" | "code"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (text: string, field?: "email" | "pw" | "code") => {
    setErr({ field, text });
    setBusy(false);
    shake(card.current);
  };

  const message = (e: unknown, wrong: string) => {
    if (e instanceof ApiError) {
      if (e.status === 401) return wrong;
      if (e.status === 429) return "Too many tries. Try again in a few minutes.";
      if (e.status === 400 || e.status === 403 || e.status === 423) return e.message;
    }
    return "Something went wrong. Please try again.";
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!EMAIL.test(email.trim())) return fail("Enter a valid email, like you@example.com.", "email");
    if (!pw) return fail("Enter your password.", "pw");
    setBusy(true);
    setErr(null);
    try {
      await adminLogin(email.trim(), pw);
      setStep("code");
      setBusy(false);
    } catch (x) {
      fail(message(x, "That email and password do not match."));
    }
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) return fail("Enter the 6-digit code from your authenticator app.", "code");
    setBusy(true);
    setErr(null);
    try {
      await adminSecondStep(code);
      router.replace(next);
      router.refresh();
    } catch (x) {
      setCode("");
      fail(message(x, "That code didn't work. Wait for a new one and try again."), "code");
    }
  };

  const banner = err && !err.field ? <Banner>{err.text}</Banner> : null;
  const fieldErr = (f: "email" | "pw" | "code") => (err?.field === f ? err.text : undefined);

  return (
    <div className="fcard" ref={card}>
      {step === "password" ? (
        <form className="view" noValidate onSubmit={submitPassword}>
          <h1 className="ttl">Admin sign-in.</h1>
          <p className="sub">For the LEADS team only.</p>
          <div className="fields">
            {banner}
            <div className="field">
              <label htmlFor="a-email">Email</label>
              <AuthInput id="a-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErr("email")} errorId="a-email-e" />
              {fieldErr("email") && <FieldError id="a-email-e">{fieldErr("email")}</FieldError>}
            </div>
            <div className="field">
              <label htmlFor="a-pw">Password</label>
              <PasswordInput id="a-pw" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} error={fieldErr("pw")} errorId="a-pw-e" />
              {fieldErr("pw") && <FieldError id="a-pw-e">{fieldErr("pw")}</FieldError>}
            </div>
            <button type="submit" className="btn b-m full" aria-disabled={busy || undefined} aria-busy={busy || undefined}>
              {busy && <Spinner />}
              {busy ? "Checking…" : "Continue"}
            </button>
          </div>
        </form>
      ) : (
        <form className="view" noValidate onSubmit={submitCode}>
          <h1 className="ttl">Enter your code.</h1>
          <p className="sub">Open your authenticator app and type the 6-digit code for LEADS.</p>
          <div className="fields">
            {banner}
            <div className="field">
              <label htmlFor="a-code">Code</label>
              <AuthInput
                id="a-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                error={fieldErr("code")}
                errorId="a-code-e"
                autoFocus
              />
              {fieldErr("code") && <FieldError id="a-code-e">{fieldErr("code")}</FieldError>}
            </div>
            <button type="submit" className="btn b-m full" aria-disabled={busy || undefined} aria-busy={busy || undefined}>
              {busy && <Spinner />}
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
