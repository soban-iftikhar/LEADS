"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { Banner, shake, Spinner } from "./parts";

type Props = {
  title: string;
  sub: ReactNode;
  /** Resolves when the code is right; throws ApiError otherwise. */
  verify: (code: string) => Promise<unknown>;
  /** Resolves with the next cooldown in seconds. */
  resend: () => Promise<{ retryAfterSec: number }>;
  onDone: () => void;
  top?: ReactNode;
  footer?: ReactNode;
};

/** Six code boxes: auto-advance, backspace goes back, paste fills all, submits when full. */
export function CodeForm({ title, sub, verify, resend, onDone, top, footer }: Props) {
  const card = useRef<HTMLDivElement>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const [filled, setFilled] = useState<boolean[]>(Array(6).fill(false));
  const [bad, setBad] = useState(false);
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(30);
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

  const clear = () => {
    boxes.current.forEach((el) => {
      if (el) el.value = "";
    });
    setFilled(Array(6).fill(false));
  };

  const submit = async () => {
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
      await verify(c);
      onDone();
    } catch (err) {
      clear();
      setBad(true);
      setBusy(false);
      busyRef.current = false;
      shake(card.current);
      if (err instanceof ApiError && err.status === 429) setBanner("Too many tries. Send a new code.");
      else if (err instanceof ApiError && err.status === 410) setBanner("That code has expired. Send a new one.");
      else if (err instanceof ApiError && err.status === 422) setBanner("That code didn't match. Try again, or send a new one.");
      else setBanner(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setTimeout(() => boxes.current[0]?.focus(), 50);
    }
  };

  const sync = () => {
    const f = boxes.current.map((el) => !!el?.value);
    setFilled(f);
    setBad(false);
    setBanner("");
    if (f.every(Boolean)) setTimeout(submit, 250);
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
    if (e.key === "Backspace" && !e.currentTarget.value && i > 0) {
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

  const again = async () => {
    try {
      const r = await resend();
      setWait(r.retryAfterSec || 30);
      setBanner("");
      clear();
      boxes.current[0]?.focus();
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const s = Number(err.errors?.retryAfterSec);
        if (s > 0) setWait(s);
        setBanner("Please wait a little before asking for another code.");
      } else setBanner(err instanceof ApiError ? err.message : "Couldn't send a new code. Try again.");
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <div className="fcard" ref={card}>
      {top}
      <form className="view" noValidate onSubmit={onSubmit}>
        <h1 className="ttl">{title}</h1>
        <p className="sub">{sub}</p>
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
            <button type="button" className="lnk" onClick={again}>
              Send a new code
            </button>
          )}
        </p>
        {footer}
      </form>
    </div>
  );
}
