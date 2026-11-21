"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ApiError, resendOtp, startPhone, verifyPhone } from "@/lib/api";
import { CodeForm } from "./CodeForm";
import { AuthInput, Banner, FieldError, shake, Spinner } from "./parts";

type Props = { pending: string | null; current: string | null; next: string };

/**
 * Add or change the WhatsApp number (DR-42): number -> 6-digit WhatsApp code.
 * A verified number unlocks listing review and the free trial; one number, one account.
 */
export function VerifyPhoneFlow({ pending, current, next }: Props) {
  const router = useRouter();
  const card = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<"number" | "code">(pending ? "code" : "number");
  const [shown, setShown] = useState(pending ?? "");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const d = phone.replace(/\D/g, "").replace(/^0/, "");
    if (!/^3\d{9}$/.test(d)) {
      setErr("Enter a 10-digit mobile number, like 300 1234567.");
      shake(card.current);
      return;
    }
    setBusy(true);
    setBanner("");
    try {
      await startPhone("0" + d);
      setShown(`+92 ${d.slice(0, 3)} ${d.slice(3)}`);
      setStep("code");
    } catch (e2) {
      if (e2 instanceof ApiError && e2.errors?.phone) setErr(e2.errors.phone);
      else if (e2 instanceof ApiError && e2.status === 429) setBanner("Too many tries. Try again in a little while.");
      else setBanner(e2 instanceof ApiError ? e2.message : "Couldn't send the code. Try again.");
      shake(card.current);
    } finally {
      setBusy(false);
    }
  };

  if (step === "code") {
    return (
      <CodeForm
        title="Check WhatsApp."
        sub={
          <>
            We sent a 6-digit code to <b className="mono" style={{ color: "var(--ink)" }}>{shown}</b>.{" "}
            <button type="button" className="lnk" onClick={() => { setStep("number"); setPhone(""); }}>
              Wrong number?
            </button>
          </>
        }
        verify={verifyPhone}
        resend={resendOtp}
        onDone={() => {
          router.replace(next);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="fcard" ref={card}>
      <form className="view" noValidate onSubmit={send}>
        <h1 className="ttl">{current ? "Change your WhatsApp." : "Add your WhatsApp."}</h1>
        <p className="sub">Leads are sent here. A verified number also unlocks your free trial. One number, one account.</p>
        <div className="fields">
          {banner && <Banner>{banner}</Banner>}
          {current && (
            <p className="mlab" style={{ margin: 0 }}>
              Now: <span className="mono">{current}</span>
            </p>
          )}
          <div className="field">
            <label htmlFor="vp-phone">WhatsApp number</label>
            <AuthInput
              id="vp-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="300 1234567"
              prefix="+92"
              autoFocus
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/[^\d\s]/g, "").slice(0, 12));
                setErr("");
              }}
              error={err}
              errorId="vp-phone-e"
            />
            {err && <FieldError id="vp-phone-e">{err}</FieldError>}
          </div>
          <button type="submit" className="btn b-m full" aria-disabled={busy || undefined} aria-busy={busy || undefined}>
            {busy && <Spinner />}
            {busy ? "Sending code…" : "Send me the code"}
          </button>
        </div>
        <p className="foot">
          <Link href={next} className="lnk">
            Not now
          </Link>
        </p>
      </form>
    </div>
  );
}
