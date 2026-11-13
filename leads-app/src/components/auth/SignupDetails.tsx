"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { ApiError, register } from "@/lib/api";
import { AuthInput, Banner, FieldError, PasswordInput, passwordStrength, shake, Spinner, Stepper, StrengthMeter, strengthLabel } from "./parts";

type Errs = Partial<Record<"agency" | "name" | "email" | "phone" | "pw" | "terms", string>>;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneOk = (v: string) => /^3\d{9}$/.test(v.replace(/\D/g, "").replace(/^0/, ""));

export function SignupDetails({ kind }: { kind: "seller" | "agency" }) {
  const router = useRouter();
  const card = useRef<HTMLDivElement>(null);
  const agency = kind === "agency";
  const [v, setV] = useState({ agency: "", name: "", email: "", phone: "", pw: "", terms: false });
  const [errs, setErrs] = useState<Errs>({});
  const [taken, setTaken] = useState<"email" | "phone" | null>(null);
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const level = passwordStrength(v.pw);

  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => {
    setV((x) => ({ ...x, [k]: val }));
    setErrs((x) => ({ ...x, [k]: undefined }));
    if (k === "email" || k === "phone") setTaken(null);
    setBanner("");
  };

  const fail = (e: Errs, b = "") => {
    setErrs(e);
    setBanner(b);
    setBusy(false);
    shake(card.current);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const fe: Errs = {};
    if (agency && !v.agency.trim()) fe.agency = "What is your agency called?";
    if (v.name.trim().length < 3) fe.name = "Please enter your full name.";
    if (!EMAIL.test(v.email.trim())) fe.email = "Enter a valid email, like you@example.com.";
    if (!phoneOk(v.phone)) fe.phone = "Enter a 10-digit mobile number, like 300 1234567.";
    if (v.pw.length < 8 || !/\d/.test(v.pw)) fe.pw = "Use 8 or more characters with a number.";
    if (!v.terms) fe.terms = "Please accept the terms to continue.";
    if (Object.keys(fe).length) return fail(fe);
    setBusy(true);
    try {
      const digits = v.phone.replace(/\D/g, "").replace(/^0/, "");
      await register({
        kind: agency ? "AGENCY" : "SELLER",
        displayName: agency ? v.agency.trim() : v.name.trim(),
        contactPerson: agency ? v.name.trim() : undefined,
        email: v.email.trim(),
        phone: "0" + digits,
        password: v.pw,
        acceptTerms: true,
      });
      try {
        sessionStorage.setItem("leads-signup-kind", "1");
      } catch {
        // storage blocked: verify page links to settings instead
      }
      router.replace("/signup/verify");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const which = err.errors?.phone ? "phone" : "email";
        setTaken(which);
        return fail({ [which]: which === "email" ? "This email already has an account." : "This number already has an account." });
      }
      if (err instanceof ApiError && err.status === 422 && err.errors) return fail(err.errors as Errs);
      fail({}, "Something went wrong. Please try again.");
    }
  };

  const err = (k: keyof Errs) =>
    errs[k] ? (
      <FieldError id={`s-${k}-e`}>
        {errs[k]}
        {taken === k && (
          <>
            {" "}
            <Link href="/login" className="lnk" style={{ fontSize: "inherit" }}>
              Log in?
            </Link>
          </>
        )}
      </FieldError>
    ) : null;

  return (
    <div className="fcard" ref={card}>
      <Stepper step={1} />
      <form className="view" noValidate onSubmit={submit}>
        <h1 className="ttl">{agency ? "About your agency." : "About you."}</h1>
        <p className="sub">We&apos;ll send a 6-digit code to your WhatsApp to check the number.</p>
        <div className="fields">
          {banner && <Banner>{banner}</Banner>}
          {agency && (
            <div className="field">
              <label htmlFor="s-agency">Agency name</label>
              <AuthInput id="s-agency" type="text" autoComplete="organization" placeholder="e.g. Al-Noor Estate" value={v.agency} onChange={(e) => set("agency", e.target.value)} error={errs.agency} errorId="s-agency-e" />
              {err("agency")}
            </div>
          )}
          <div className="field">
            <label htmlFor="s-name">Your full name</label>
            <AuthInput id="s-name" type="text" autoComplete="name" placeholder="e.g. Soban Iftikhar" value={v.name} onChange={(e) => set("name", e.target.value)} error={errs.name} errorId="s-name-e" />
            {err("name")}
          </div>
          <div className="field">
            <label htmlFor="s-email">Email</label>
            <AuthInput id="s-email" type="email" autoComplete="email" placeholder="you@example.com" value={v.email} onChange={(e) => set("email", e.target.value)} error={errs.email} errorId="s-email-e" />
            {err("email")}
          </div>
          <div className="field">
            <label htmlFor="s-phone">WhatsApp number</label>
            <AuthInput id="s-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="300 1234567" prefix="+92" value={v.phone} onChange={(e) => set("phone", e.target.value.replace(/[^\d\s]/g, "").slice(0, 12))} error={errs.phone} errorId="s-phone-e" />
            {err("phone")}
          </div>
          <div className="field">
            <div className="lb">
              <label htmlFor="s-pw">Password</label>
              <span className="mlab" aria-live="polite">
                {strengthLabel(level)}
              </span>
            </div>
            <PasswordInput id="s-pw" autoComplete="new-password" placeholder="At least 8 characters" value={v.pw} onChange={(e) => set("pw", e.target.value)} error={errs.pw} errorId="s-pw-e" />
            <StrengthMeter level={level} />
            {err("pw")}
          </div>
          <div className="field">
            <label className="chk">
              <input type="checkbox" checked={v.terms} onChange={(e) => set("terms", e.target.checked)} aria-invalid={!!errs.terms} aria-describedby={errs.terms ? "s-terms-e" : undefined} />
              <span className="bx">
                <Icon name="check" size={14} strokeWidth={3.2} />
              </span>
              {/* Terms and Privacy pages aren't in this handoff yet */}
              <span>
                I agree to the <span className="lnk">Terms</span> and <span className="lnk">Privacy policy</span>
              </span>
            </label>
            {err("terms")}
          </div>
          <button type="submit" className="btn b-m full" aria-disabled={busy || undefined} aria-busy={busy || undefined}>
            {busy && <Spinner />}
            {busy ? "Sending code…" : "Send me the code"}
          </button>
        </div>
        <p className="foot">
          <Link href={`/signup?type=${kind}`} className="lnk">
            ← Change account type
          </Link>
        </p>
      </form>
    </div>
  );
}
