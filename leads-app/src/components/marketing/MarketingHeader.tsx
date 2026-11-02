import Link from "next/link";
import { LampToggle } from "@/components/app/LampToggle";
import { LogoMark } from "./Logo";

/** Landing header: section links, lamp, Log in (or Dashboard when signed in), primary CTA. */
export function MarketingHeader({ signedIn, home = true }: { signedIn: boolean; home?: boolean }) {
  const a = (hash: string) => (home ? hash : `/${hash}`);
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 76 }}>
        <Link href="/" className="logo-a" aria-label="LEADS home" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "var(--ink)" }}>
          <LogoMark ping />
          <span style={{ fontWeight: 800, fontSize: 25, letterSpacing: "-.05em" }}>leads</span>
        </Link>
        <nav aria-label="Main" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div className="links" style={{ gap: 2, marginRight: 8 }}>
            <a href={a("#how")} className="nl">How it works</a>
            <a href={a("#pricing")} className="nl">Pricing</a>
            <a href={a("#agencies")} className="nl">For agencies</a>
            <a href={a("#faq")} className="nl">FAQ</a>
          </div>
          <LampToggle />
          {signedIn ? (
            <Link href="/dashboard" className="nl">Dashboard</Link>
          ) : (
            <Link href="/login" className="nl">Log in</Link>
          )}
          <Link href={signedIn ? "/listings/new" : "/signup"} className="btn b-m b-sm np">
            List your property
          </Link>
        </nav>
      </div>
    </header>
  );
}
