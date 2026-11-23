import Link from "next/link";
import { areaPages } from "@/server/modules/catalog/service";
import { LogoMark } from "@/components/brand/Logo";

type Col = { title: string; links: { label: string; href: string }[] };

const SITE: Col = {
  title: "LEADS",
  links: [
    { label: "How it works", href: "/#how" },
    { label: "Pricing", href: "/#pricing" },
    { label: "For agencies", href: "/#agencies" },
    { label: "FAQ", href: "/#faq" },
    { label: "Log in", href: "/login" },
  ],
};
const AREAS_PER_CITY = 5;

/** One column per active city, linking its first areas (config.localities, never hardcoded). */
async function areaColumns(): Promise<{ cols: Col[]; cities: string[] }> {
  const areas = await areaPages().catch(() => []);
  const byCity = new Map<string, Col>();
  for (const a of areas) {
    const col = byCity.get(a.city) ?? { title: `Sell in ${a.cityName}`, links: [] };
    if (col.links.length < AREAS_PER_CITY) col.links.push({ label: `Sell in ${a.name}`, href: `/sell/${a.city}/${a.area}` });
    byCity.set(a.city, col);
  }
  return { cols: [...byCity.values()], cities: [...new Set(areas.map((a) => a.cityName))] };
}

export async function MarketingFooter() {
  const { cols, cities } = await areaColumns();
  return (
    <footer style={{ borderTop: "1px solid var(--line)", padding: "clamp(48px,6vw,72px) 0 32px" }}>
      <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <LogoMark size={34} />
              <span style={{ fontWeight: 800, fontSize: 21, letterSpacing: "-.05em" }}>leads</span>
            </span>
            <p style={{ margin: 0, fontSize: 14.5, color: "var(--ink-3)", maxWidth: 260 }}>{cities.length ? `Buyers for your property in ${cities.join(" and ")}.` : "Buyers for your property."}</p>
          </div>
          {[SITE, ...cols].map((c) => (
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
