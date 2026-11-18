"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, resendEmailCode, updateMe, verifyEmail } from "@/lib/api";
import { CodeForm } from "./CodeForm";
import { AuthInput, FieldError, Spinner, Stepper } from "./parts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step 3 of signup: the 6-digit code from the email. "Wrong email?" fixes it in place. */
export function VerifyEmailCode({ email: initial, next }: { email: string; next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);

  const change = async (e: FormEvent) => {
    e.preventDefault();
    const v = draft.trim().toLowerCase();
    if (!EMAIL.test(v)) return setErr("Enter a valid email, like you@example.com.");
    if (v === email) return setEditing(false);
    setBusy(true);
    try {
      await updateMe({ email: v });
      setEmail(v);
      setEditing(false);
      setRound((r) => r + 1); // fresh boxes and timer for the new code
    } catch (e2) {
      setErr(e2 instanceof ApiError ? (e2.errors?.email ?? e2.message) : "Couldn't change it. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="fcard">
        <Stepper step={2} />
        <form className="view" noValidate onSubmit={change}>
          <h1 className="ttl">Fix your email.</h1>
          <p className="sub">We&apos;ll send a new code there.</p>
          <div className="fields">
            <div className="field">
              <label htmlFor="ve-email">Email</label>
              <AuthInput id="ve-email" type="email" autoComplete="email" value={draft} onChange={(e) => { setDraft(e.target.value); setErr(""); }} error={err} errorId="ve-email-e" />
              {err && <FieldError id="ve-email-e">{err}</FieldError>}
            </div>
            <button type="submit" className="btn b-m full" aria-busy={busy || undefined}>
              {busy && <Spinner />}
              {busy ? "Sending…" : "Send me the code"}
            </button>
          </div>
          <p className="foot">
            <button type="button" className="lnk" onClick={() => setEditing(false)}>
              ← Back
            </button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <CodeForm
      key={round}
      top={<Stepper step={2} />}
      title="Check your email."
      sub={
        <>
          We sent a 6-digit code to <b style={{ color: "var(--ink)" }}>{email}</b>.{" "}
          <button type="button" className="lnk" onClick={() => { setDraft(email); setEditing(true); }}>
            Wrong email?
          </button>
        </>
      }
      verify={verifyEmail}
      resend={resendEmailCode}
      onDone={() => {
        router.replace(next);
        router.refresh();
      }}
    />
  );
}
