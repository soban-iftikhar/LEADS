import Link from "next/link";
import { LogoMark } from "./Logo";

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "LEADS",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Pricing", href: "/#pricing" },
      { label: "For agencies", href: "/#agencies" },
      { label: "FAQ", href: "/#faq" },
      { label: "Log in", href: "/login" },
    ],
  },
  {
    title: "Sell in Islamabad",
    links: [
      { label: "Sell house in G-13", href: "/sell/islamabad/g-13" },
      { label: "Sell house in B-17", href: "/sell/islamabad/b-17" },
      { label: "Sell plot in DHA Phase 2", href: "/sell/islamabad/dha-phase-2" },
      { label: "Sell house in F-11", href: "/sell/islamabad/f-11" },
      { label: "Sell house in G-14", href: "/sell/islamabad/g-14" },
    ],
  },
  {
    title: "Sell in Rawalpindi",
    links: [
      { label: "Sell house in Bahria Town", href: "/sell/rawalpindi/bahria-town" },
      { label: "Sell house in Gulraiz", href: "/sell/rawalpindi/gulraiz" },
      { label: "Sell house in Satellite Town", href: "/sell/rawalpindi/satellite-town" },
      { label: "Sell plot in Adiala Road", href: "/sell/rawalpindi/adiala-road" },
      { label: "Sell house in Saddar", href: "/sell/rawalpindi/saddar" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", padding: "clamp(48px,6vw,72px) 0 32px" }}>
      <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <LogoMark size={34} />
              <span style={{ fontWeight: 800, fontSize: 21, letterSpacing: "-.05em" }}>leads</span>
            </span>
            <p style={{ margin: 0, fontSize: 14.5, color: "var(--ink-3)", maxWidth: 260 }}>Buyers for your property in Islamabad and Rawalpindi.</p>
            {/* buyer catalogue is reserved for the buyer-side handoff */}
            <span style={{ fontSize: 14.5, color: "var(--m-ink)", fontWeight: 700 }}>Looking to buy? Browse homes →</span>
          </div>
          {COLS.map((c) => (
            <nav key={c.title} aria-label={c.title} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{c.title}</span>
              {c.links.map((l) => (
                <Link key={l.href} href={l.href} style={{ fontSize: 14.5, color: "var(--ink-3)", textDecoration: "none" }}>
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, paddingTop: 24, borderTop: "1px solid var(--line)", fontSize: 13.5, color: "var(--ink-3)" }}>
          <span>© 2026 LEADS · Islamabad, Pakistan</span>
          <span style={{ display: "flex", gap: 18 }}>
            <span>Terms</span>
            <span>Privacy</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
