"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { AuthTabs, Stepper } from "./parts";

type Kind = "seller" | "agency";

const OwnerIll = () => (
  <svg className="ill" viewBox="0 0 84 62" aria-hidden="true">
    <g className="hs">
      <path d="M20 26 42 8l22 18z" style={{ fill: "var(--m)", stroke: "var(--bot-line)", strokeWidth: 3, strokeLinejoin: "round" }} />
      <rect x="26" y="22" width="32" height="38" rx="6" style={{ fill: "var(--bot-body)", stroke: "var(--bot-line)", strokeWidth: 3 }} />
      <rect x="36" y="40" width="12" height="20" rx="3" style={{ fill: "var(--m-mid)" }} />
    </g>
  </svg>
);

const AgencyIll = () => (
  <svg className="ill" viewBox="0 0 84 62" aria-hidden="true">
    <g className="hs">
      <path d="M2 36 16 24l14 12z" style={{ fill: "var(--m-tint)", stroke: "var(--bot-line)", strokeWidth: 2.6, strokeLinejoin: "round" }} />
      <rect x="6" y="33" width="20" height="27" rx="4" style={{ fill: "var(--bot-body)", stroke: "var(--bot-line)", strokeWidth: 2.6 }} />
    </g>
    <g className="hs">
      <path d="M22 26 42 8l20 18z" style={{ fill: "var(--m)", stroke: "var(--bot-line)", strokeWidth: 3, strokeLinejoin: "round" }} />
      <rect x="28" y="22" width="28" height="38" rx="6" style={{ fill: "var(--bot-body)", stroke: "var(--bot-line)", strokeWidth: 3 }} />
    </g>
    <g className="hs">
      <path d="M54 36 68 24l14 12z" style={{ fill: "var(--m-tint)", stroke: "var(--bot-line)", strokeWidth: 2.6, strokeLinejoin: "round" }} />
      <rect x="58" y="33" width="20" height="27" rx="4" style={{ fill: "var(--bot-body)", stroke: "var(--bot-line)", strokeWidth: 2.6 }} />
    </g>
  </svg>
);

export function SignupType({ initial }: { initial: Kind }) {
  const [kind, setKind] = useState<Kind>(initial);
  const group = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next: Kind = kind === "seller" ? "agency" : "seller";
    setKind(next);
    group.current?.querySelector<HTMLButtonElement>(`[data-kind="${next}"]`)?.focus();
  };
  const card = (k: Kind, title: string, text: string, ill: React.ReactNode) => (
    <button
      type="button"
      className="rc"
      role="radio"
      data-kind={k}
      aria-checked={kind === k}
      tabIndex={kind === k ? 0 : -1}
      onClick={() => setKind(k)}
    >
      <span className="tick" aria-hidden="true">
        <Icon name="check" size={14} strokeWidth={3.2} />
      </span>
      {ill}
      <b>{title}</b>
      <span>{text}</span>
    </button>
  );
  return (
    <div className="fcard">
      <AuthTabs active="signup" />
      <Stepper step={0} />
      <div className="view">
        <h1 className="ttl">Who&apos;s listing?</h1>
        <p className="sub">Pick one. You can&apos;t mix both in one account.</p>
        <div className="roles" role="radiogroup" aria-label="Account type" ref={group} onKeyDown={onKey}>
          {card("seller", "Owner", "I'm selling my own house or plot.", <OwnerIll />)}
          {card("agency", "Agency", "We list many properties for clients.", <AgencyIll />)}
        </div>
        <Link href={`/signup/details?type=${kind}`} className="btn b-m full" style={{ marginTop: 26 }}>
          Continue as {kind === "agency" ? "an agency" : "an owner"}
        </Link>
        <p className="foot">
          Already have an account?{" "}
          <Link href="/login" className="lnk">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
