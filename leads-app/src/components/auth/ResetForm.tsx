"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, Note, TextInput } from "@/components/ui";
import { ApiError, resetPassword } from "@/lib/api";
import { passwordStrength, strengthLabel } from "./parts";

const COLOURS = ["var(--line)", "var(--err)", "var(--m-mid)", "var(--m)", "var(--ink)"];

/** B5 Reset (design/screens/auth-reset.html). Callback from the reset email: ?token=<raw>. */
export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
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
    if (fe.pw || fe.pw2) return setErrs(fe);
    setBusy(true);
    try {
      await resetPassword(token, pw);
      router.replace("/login?reset=done");
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 410) return setExpired(true);
      if (err instanceof ApiError && err.errors?.password) return setErrs({ pw: err.errors.password });
      setBanner("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="app-ui acard-host">
      <form className="acard" noValidate onSubmit={submit}>
        <h1>Set a new password.</h1>
        {expired ? (
          <>
            <Note tone="warn" icon="alert" role="alert">
              This link has expired.
            </Note>
            <Button href="/forgot-password" variant="primary" size="lg" full>
              Send a new link
            </Button>
          </>
        ) : (
          <>
            <p>At least 8 characters with a number.</p>
            {banner && (
              <Note tone="warn" icon="alert" role="alert">
                {banner}
              </Note>
            )}
            <Field label="New password" error={errs.pw} aside={<span className="mlab muted" aria-live="polite" style={{ fontSize: 13 }}>{strengthLabel(level)}</span>}>
              <TextInput type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setErrs({}); }} />
            </Field>
            <div className="meter4" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <i key={n} style={{ background: n <= level ? COLOURS[level] : undefined }} />
              ))}
            </div>
            <Field label="Repeat new password" error={errs.pw2}>
              <TextInput type="password" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErrs({}); }} />
            </Field>
            <Button type="submit" variant="primary" size="lg" full loading={busy} loadingLabel="Saving…">
              Save new password
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
