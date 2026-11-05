"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { ApiError, completeGoogleSignup } from "@/lib/api";
import { AuthInput, Banner, FieldError, shake, Spinner, Stepper } from "./parts";

type Kind = "SELLER" | "AGENCY";

export function GoogleComplete({ email, name, initial }: { email: string; name: string; initial: Kind }) {
  const router = useRouter();
  const card = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<Kind>(initial);
  const [agencyName, setAgencyName] = useState("");
  const [terms, setTerms] = useState(false);
  const [errs, setErrs] = useState<{ agencyName?: string; terms?: string }>({});
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const fe: typeof errs = {};
    if (kind === "AGENCY" && agencyName.trim().length < 2) fe.agencyName = "What is your agency called?";
    if (!terms) fe.terms = "Please accept the terms to continue.";
    if (fe.agencyName || fe.terms) {
      setErrs(fe);
      shake(card.current);
      return;
    }
    setBusy(true);
    try {
      await completeGoogleSignup({ kind, agencyName: kind === "AGENCY" ? agencyName.trim() : undefined, acceptTerms: true });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 410) {
        router.replace("/signup");
        return;
      }
      setBanner(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      shake(card.current);
    }
  };

  const card2 = (k: Kind, title: string, text: string) => (
    <button type="button" className="rc" role="radio" aria-checked={kind === k} tabIndex={kind === k ? 0 : -1} onClick={() => setKind(k)}>
      <span className="tick" aria-hidden="true">
        <Icon name="check" size={14} strokeWidth={3.2} />
      </span>
      <b>{title}</b>
      <span>{text}</span>
    </button>
  );

  return (
    <div className="fcard" ref={card}>
      <Stepper step={1} />
      <form className="view" noValidate onSubmit={submit}>
        <h1 className="ttl">One more step.</h1>
        <p className="sub">
          Signed in with Google as <b style={{ color: "var(--ink)" }}>{email}</b>. Who&apos;s listing, {name.split(" ")[0]}?
        </p>
        {banner && (
          <div style={{ marginTop: 22 }}>
            <Banner>{banner}</Banner>
          </div>
        )}
        <div
          className="roles"
          role="radiogroup"
          aria-label="Account type"
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
              e.preventDefault();
              setKind((k) => (k === "SELLER" ? "AGENCY" : "SELLER"));
            }
          }}
        >
          {card2("SELLER", "Owner", "I'm selling my own house or plot.")}
          {card2("AGENCY", "Agency", "We list many properties for clients.")}
        </div>
        <div className="fields">
          {kind === "AGENCY" && (
            <div className="field">
              <label htmlFor="g-agency">Agency name</label>
              <AuthInput id="g-agency" autoComplete="organization" placeholder="e.g. Al-Noor Estate" value={agencyName} onChange={(e) => { setAgencyName(e.target.value); setErrs((x) => ({ ...x, agencyName: undefined })); }} error={errs.agencyName} errorId="g-agency-e" />
              {errs.agencyName && <FieldError id="g-agency-e">{errs.agencyName}</FieldError>}
            </div>
          )}
          <div className="field">
            <label className="chk">
              <input type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); setErrs((x) => ({ ...x, terms: undefined })); }} aria-invalid={!!errs.terms} aria-describedby={errs.terms ? "g-terms-e" : undefined} />
              <span className="bx">
                <Icon name="check" size={14} strokeWidth={3.2} />
              </span>
              <span>
                I agree to the <span className="lnk">Terms</span> and <span className="lnk">Privacy policy</span>
              </span>
            </label>
            {errs.terms && <FieldError id="g-terms-e">{errs.terms}</FieldError>}
          </div>
          <button type="submit" className="btn b-m full" aria-busy={busy || undefined}>
            {busy && <Spinner />}
            {busy ? "Creating your account…" : "Create my account"}
          </button>
        </div>
        <p className="foot">
          <Link href="/login" className="lnk">
            ← Use another account
          </Link>
        </p>
      </form>
    </div>
  );
}
