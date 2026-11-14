"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ApiError, forgotPassword } from "@/lib/api";
import { AuthInput, Banner, FieldError, QuietNote, shake, Spinner } from "./parts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotForm() {
  const card = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [banner, setBanner] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!EMAIL.test(email.trim())) {
      setErr("Enter a valid email, like you@example.com.");
      shake(card.current);
      return;
    }
    setBusy(true);
    setBanner("");
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (e2) {
      // the API answers 200 whatever the email; only rate limits and outages reach here
      setBanner(e2 instanceof ApiError && e2.status === 429 ? "Too many tries. Try again in a few minutes." : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fcard" ref={card}>
      <form className="view" noValidate onSubmit={submit}>
        <h1 className="ttl">Forgot password?</h1>
        <p className="sub">Enter your email. We&apos;ll send you a link to set a new one.</p>
        <div className="fields">
          {sent && <QuietNote>If that email has an account, we sent a link. Check your inbox.</QuietNote>}
          {banner && <Banner>{banner}</Banner>}
          <div className="field">
            <label htmlFor="f-email">Email</label>
            <AuthInput
              id="f-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErr("");
              }}
              error={err}
              errorId="f-email-e"
            />
            {err && <FieldError id="f-email-e">{err}</FieldError>}
          </div>
          <button type="submit" className="btn b-m full" aria-disabled={busy || undefined} aria-busy={busy || undefined}>
            {busy && <Spinner />}
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </div>
        <p className="foot">
          <Link href="/login" className="lnk">
            ← Back to log in
          </Link>
        </p>
      </form>
    </div>
  );
}
