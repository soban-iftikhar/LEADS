import Link from "next/link";
import { Ghar } from "@/components/app/Ghar";
import { LampToggle } from "@/components/app/LampToggle";
import { LogoMark } from "@/components/marketing/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-ui" style={{ minHeight: "100vh" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 clamp(16px,2.6vw,40px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 76 }}>
          <Link href="/" aria-label="LEADS home" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "var(--ink)" }}>
            <LogoMark size={40} />
            <span style={{ fontWeight: 800, fontSize: 24, letterSpacing: "-.05em" }}>leads</span>
          </Link>
          <nav aria-label="Account" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Link href="/" className="nl">
              ← Back to site
            </Link>
            <LampToggle />
          </nav>
        </div>
      </header>
      <main className="auth">
        <section className="form-p" aria-label="Account">
          {children}
        </section>
      </main>
      <Ghar area="auth" />
    </div>
  );
}
