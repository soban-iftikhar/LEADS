"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { ApiError, resetPassword } from "@/lib/api";
import { Banner, FieldError, PasswordInput, passwordStrength, shake, Spinner, StrengthMeter, strengthLabel } from "./parts";

function Expired() {
  return (
    <div className="fields" style={{ marginTop: 22 }}>
      <div className="banner" role="alert">
        <Icon name="alert" size={18} />
        <span>This link has expired.</span>
      </div>
      <Link href="/forgot-password" className="btn b-m full">
        Send a new link
      </Link>
    </div>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const card = useRef<HTMLDivElement>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [errs, setErrs] = useState<{ pw?: string; pw2?: string }>({});
  const [expired, setExpired] = useState(!token);
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const level = passwordStrength(pw);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const fe: typeof errs = {};
    if (pw.length < 8 || !/\d/.test(pw)) fe.pw = "Use 8 or more characters with a number.";
    if (pw2 !== pw) fe.pw2 = "The two passwords don't match.";
    if (fe.pw || fe.pw2) {
      setErrs(fe);
      shake(card.current);
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token, pw);
      router.replace("/login?reset=done");
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 410) return setExpired(true);
      if (err instanceof ApiError && err.status === 422 && err.errors?.password) return setErrs({ pw: err.errors.password });
      setBanner("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="fcard" ref={card}>
      <form className="view" noValidate onSubmit={submit}>
        <h1 className="ttl">Set a new password.</h1>
        {expired ? (
          <Expired />
        ) : (
          <>
            <p className="sub">Use 8 or more characters with a number.</p>
            <div className="fields">
              {banner && <Banner>{banner}</Banner>}
              <div className="field">
                <div className="lb">
                  <label htmlFor="r-pw">New password</label>
                  <span className="mlab" aria-live="polite">
                    {strengthLabel(level)}
                  </span>
                </div>
                <PasswordInput id="r-pw" autoComplete="new-password" placeholder="At least 8 characters" value={pw} onChange={(e) => { setPw(e.target.value); setErrs({}); }} error={errs.pw} errorId="r-pw-e" />
                <StrengthMeter level={level} />
                {errs.pw && <FieldError id="r-pw-e">{errs.pw}</FieldError>}
              </div>
              <div className="field">
                <label htmlFor="r-pw2">Repeat new password</label>
                <PasswordInput id="r-pw2" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErrs({}); }} error={errs.pw2} errorId="r-pw2-e" />
                {errs.pw2 && <FieldError id="r-pw2-e">{errs.pw2}</FieldError>}
              </div>
              <button type="submit" className="btn b-m full" aria-disabled={busy || undefined} aria-busy={busy || undefined}>
                {busy && <Spinner />}
                {busy ? "Saving…" : "Save new password"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
