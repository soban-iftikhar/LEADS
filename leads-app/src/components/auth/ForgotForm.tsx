"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Field, Note, TextInput } from "@/components/ui";
import { ApiError, forgotPassword } from "@/lib/api";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** B5 Forgot (design/screens/auth-forgot.html). Never says whether the email exists. */
export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [banner, setBanner] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!EMAIL.test(email.trim())) return setErr("Enter a valid email, like you@example.com.");
    setBusy(true);
    setBanner("");
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (e2) {
      setBanner(e2 instanceof ApiError && e2.status === 429 ? "Too many tries. Try again in a few minutes." : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-ui acard-host">
      <form className="acard" noValidate onSubmit={submit}>
        <Link href="/login" className="back">
          ← Log in
        </Link>
        <h1>Forgot your password?</h1>
        <p>Enter the email you log in with. We&apos;ll send a link to set a new one.</p>
        {banner && (
          <Note tone="warn" icon="alert" role="alert">
            {banner}
          </Note>
        )}
        <Field label="Email" error={err}>
          <TextInput type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
        </Field>
        <Button type="submit" variant="primary" size="lg" full loading={busy} loadingLabel="Sending…">
          Send reset link
        </Button>
        {sent && (
          <Note icon="info" role="status">
            If that email has an account, we sent a link. Check your inbox.
          </Note>
        )}
      </form>
    </div>
  );
}
