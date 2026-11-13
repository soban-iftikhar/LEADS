"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { ApiError, login } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { AuthInput, AuthTabs, Banner, FieldError, PasswordInput, QuietNote, shake, Spinner } from "./parts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ next, note }: { next: string; note: string | null }) {
  const router = useRouter();
  const card = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [errs, setErrs] = useState<{ email?: string; pw?: string }>({});
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);

  const fail = (e: typeof errs, b = "") => {
    setErrs(e);
    setBanner(b);
    setBusy(false);
    shake(card.current);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const fe: typeof errs = {};
    if (!EMAIL.test(email.trim())) fe.email = "Enter a valid email, like you@example.com.";
    if (!pw) fe.pw = "Enter your password.";
    if (fe.email || fe.pw) return fail(fe);
    setBusy(true);
    setErrs({});
    setBanner("");
    try {
      await login(email.trim(), pw, remember);
      router.replace(next);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          router.replace("/signup/verify");
          return;
        }
        if (err.status === 423) {
          const until = err.errors?.lockedUntil;
          return fail({}, until ? `Too many tries. Try again at ${formatTime(until)}.` : "Too many tries. Try again later.");
        }
        if (err.status === 401) return fail({}, "That email and password do not match.");
        if (err.status === 429) return fail({}, "Too many tries. Try again in a few minutes.");
      }
      fail({}, "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="fcard" ref={card}>
      <AuthTabs active="login" />
      <form className="view" noValidate onSubmit={submit}>
        <h1 className="ttl">Welcome back.</h1>
        <p className="sub">Log in to see your leads.</p>
        <div className="fields">
          {note && <QuietNote>{note}</QuietNote>}
          {banner && <Banner>{banner}</Banner>}
          <div className="field">
            <label htmlFor="l-email">Email</label>
            <AuthInput
              id="l-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrs((x) => ({ ...x, email: undefined }));
                setBanner("");
              }}
              error={errs.email}
              errorId="l-email-e"
            />
            {errs.email && <FieldError id="l-email-e">{errs.email}</FieldError>}
          </div>
          <div className="field">
            <label htmlFor="l-pw">Password</label>
            <PasswordInput
              id="l-pw"
              autoComplete="current-password"
              placeholder="Your password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setErrs((x) => ({ ...x, pw: undefined }));
                setBanner("");
              }}
              error={errs.pw}
              errorId="l-pw-e"
            />
            {errs.pw && <FieldError id="l-pw-e">{errs.pw}</FieldError>}
          </div>
          <div className="row">
            <label className="chk">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="bx">
                <Icon name="check" size={14} strokeWidth={3.2} />
              </span>
              Keep me logged in
            </label>
            <Link href="/forgot-password" className="lnk">
              Forgot password?
            </Link>
          </div>
          <button type="submit" className="btn b-m full" aria-disabled={busy || undefined} aria-busy={busy || undefined}>
            {busy && <Spinner />}
            {busy ? "Logging in…" : "Log in"}
          </button>
        </div>
        <p className="foot">
          New to LEADS?{" "}
          <Link href="/signup" className="lnk">
            Create a free account
          </Link>
        </p>
      </form>
    </div>
  );
}
