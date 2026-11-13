"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { ApiError, resendOtp, verifyPhone } from "@/lib/api";
import { Banner, shake, Spinner, Stepper } from "./parts";

const SIGNUP_FLAG = "leads-signup-kind";

/** Set by the details step, so "Wrong number?" can go back there instead of to settings. */
function readSignupFlag(): boolean {
  try {
    return sessionStorage.getItem(SIGNUP_FLAG) === "1";
  } catch {
    return false;
  }
}
const noSubscribe = () => () => {};

export function VerifyPhone({ phone, kind }: { phone: string; kind: "seller" | "agency" }) {
  const router = useRouter();
  const card = useRef<HTMLDivElement>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const [filled, setFilled] = useState<boolean[]>(Array(6).fill(false));
  const [bad, setBad] = useState(false);
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(30);
  const fromSignup = useSyncExternalStore(noSubscribe, readSignupFlag, () => false);
  const busyRef = useRef(false);

  useEffect(() => {
    boxes.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const code = () => boxes.current.map((el) => el?.value ?? "").join("");

  const verify = async () => {
    if (busyRef.current) return;
    const c = code();
    if (c.length < 6) {
      setBanner("Enter all 6 digits.");
      shake(card.current);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setBanner("");
    try {
      await verifyPhone(c);
      try {
        sessionStorage.removeItem(SIGNUP_FLAG);
      } catch {
        // ignore
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      boxes.current.forEach((el) => {
        if (el) el.value = "";
      });
      setFilled(Array(6).fill(false));
      setBad(true);
      setBusy(false);
      busyRef.current = false;
      shake(card.current);
      if (err instanceof ApiError && err.status === 429) setBanner("Too many tries. Send a new code.");
      else if (err instanceof ApiError && err.status === 410) setBanner("That code has expired. Send a new one.");
      else setBanner("That code didn't match. Try again, or send a new one.");
      setTimeout(() => boxes.current[0]?.focus(), 50);
    }
  };

  const sync = () => {
    const f = boxes.current.map((el) => !!el?.value);
    setFilled(f);
    setBad(false);
    setBanner("");
    if (f.every(Boolean)) setTimeout(verify, 250);
  };

  const fillFrom = (i: number, digits: string) => {
    for (let k = 0; k < digits.length && i + k < 6; k++) {
      const el = boxes.current[i + k];
      if (el) el.value = digits[k];
    }
    boxes.current[Math.min(5, i + digits.length)]?.focus();
    sync();
  };

  const onInput = (i: number, el: HTMLInputElement) => {
    const digits = el.value.replace(/\D/g, "");
    if (digits.length > 1) return fillFrom(i, digits);
    el.value = digits;
    if (digits && i < 5) boxes.current[i + 1]?.focus();
    sync();
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (e.key === "Backspace" && !el.value && i > 0) {
      e.preventDefault();
      const prev = boxes.current[i - 1];
      if (prev) {
        prev.value = "";
        prev.focus();
      }
      sync();
    }
    if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      boxes.current[i - 1]?.focus();
    }
    if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      boxes.current[i + 1]?.focus();
    }
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    const d = e.clipboardData.getData("text").replace(/\D/g, "");
    if (d) {
      e.preventDefault();
      fillFrom(i, d);
    }
  };

  const resend = async () => {
    try {
      const r = await resendOtp();
      setWait(r.retryAfterSec || 30);
      setBanner("");
    } catch (err) {
      setBanner(err instanceof ApiError && err.status === 429 ? "Please wait a little before asking for another code." : "Couldn't send a new code. Try again.");
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    verify();
  };

  const [cc, ...rest] = phone.split(" ");
  return (
    <div className="fcard" ref={card}>
      <Stepper step={2} />
      <form className="view" noValidate onSubmit={submit}>
        <h1 className="ttl">Check WhatsApp.</h1>
        <p className="sub">
          We sent a 6-digit code to{" "}
          <b className="mono" style={{ color: "var(--ink)" }}>
            {cc} {rest.join(" ")}
          </b>
          .{" "}
          <Link href={fromSignup ? `/signup/details?type=${kind}` : "/settings#profile"} className="lnk">
            Wrong number?
          </Link>
        </p>
        {banner && (
          <div style={{ marginTop: 22 }}>
            <Banner>{banner}</Banner>
          </div>
        )}
        <div className="otp" role="group" aria-label="6-digit code">
          {Array.from({ length: 6 }, (_, i) => (
            <input
              key={i}
              ref={(el) => {
                boxes.current[i] = el;
              }}
              className={`ob ${bad ? "bad" : filled[i] ? "f" : ""}`}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={6}
              aria-label={`Digit ${i + 1}`}
              onInput={(e) => onInput(i, e.currentTarget)}
              onKeyDown={(e) => onKey(i, e)}
              onPaste={(e) => onPaste(i, e)}
              onFocus={(e) => e.currentTarget.select()}
            />
          ))}
        </div>
        <button type="submit" className="btn b-m full" style={{ marginTop: 22 }} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
          {busy && <Spinner />}
          {busy ? "Checking…" : "Verify"}
        </button>
        <p className="foot">
          {wait > 0 ? (
            <span>
              New code in <b className="mono">0:{String(wait).padStart(2, "0")}</b>
            </span>
          ) : (
            <button type="button" className="lnk" onClick={resend}>
              Send a new code
            </button>
          )}
        </p>
      </form>
    </div>
  );
}
