"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/icons";
import { logout } from "@/lib/api";
import { CUSTOMER_KIND } from "@/lib/labels";
import { usePageTransition } from "@/lib/hooks/usePageTransition";
import { useRailCollapsed } from "@/lib/hooks/useRailCollapsed";
import { RAIL_STORAGE_KEY } from "@/lib/theme";
import type { Me } from "@/types/api";
import { useBadges } from "./badges";
import { Ghar } from "@/components/brand/Ghar";
import { LampToggle } from "@/components/brand/LampToggle";

// ---------------------------------------------------------------- navigation model (ROUTES.md §3)

type Item = { key: string; label: string; href: string; icon: IconName; match: string[]; badge?: "leads" | "unread" };

const RAIL: Item[] = [
  { key: "overview", label: "Overview", href: "/dashboard", icon: "dash", match: ["/dashboard"] },
  { key: "leads", label: "Leads", href: "/leads", icon: "inbox", match: ["/leads"], badge: "leads" },
  { key: "listings", label: "Listings", href: "/listings", icon: "home", match: ["/listings"] },
  { key: "packages", label: "Packages", href: "/packages", icon: "box", match: ["/packages", "/checkout"] },
  { key: "notifications", label: "Notifications", href: "/notifications", icon: "bell", match: ["/notifications"], badge: "unread" },
  { key: "settings", label: "Settings", href: "/settings", icon: "gear", match: ["/settings"] },
];

const TABS: Item[] = [
  RAIL[0],
  RAIL[1],
  RAIL[2],
  RAIL[3],
  { key: "account", label: "Account", href: "/settings", icon: "user", match: ["/settings", "/notifications"] },
];

const isOn = (path: string, match: string[]) => match.some((m) => path === m || path.startsWith(m + "/"));

/** Breadcrumb title per route (prototype). Pages can override it, e.g. "Lead · Bilal Ahmed". */
function titleFor(path: string): string {
  if (path === "/dashboard") return "Overview";
  if (path === "/leads") return "Leads";
  if (path.startsWith("/leads/")) return "Lead";
  if (path === "/listings") return "Listings";
  if (path === "/listings/new") return "Add listing";
  if (/^\/listings\/[^/]+\/edit$/.test(path)) return "Edit listing";
  if (path.startsWith("/listings/")) return "Listing status";
  if (path === "/packages") return "Packages";
  if (path === "/packages/buy") return "Buy leads";
  if (/^\/checkout\/[^/]+\/return$/.test(path)) return "Payment result";
  if (path.startsWith("/checkout/")) return "Payment";
  if (path === "/notifications") return "Notifications";
  if (path === "/settings") return "Settings";
  return "";
}

/**
 * Key for the page wrapper: a new key replays the enter animation. The add-listing form moves its
 * own address from /listings/new to /listings/<id>/edit while you type; that must not remount it.
 */
const paneKey = (path: string) => (path === "/listings/new" || /^\/listings\/[^/]+\/edit$/.test(path) ? "listing-form" : path);

// ---------------------------------------------------------------- crumb override

const CrumbCtx = createContext<(t: string | null) => void>(() => {});

/** Lets a page name itself in the header breadcrumb ("Lead · Bilal Ahmed"). */
export function SetCrumb({ title }: { title: string }) {
  const set = useContext(CrumbCtx);
  useEffect(() => {
    set(title);
    return () => set(null);
  }, [title, set]);
  return null;
}

const COUNT_SELECTOR = ".stat .v, .hero .big b, .callc .big, .hrow .v";

// ---------------------------------------------------------------- the shell

export function AppShell({ me, children }: { me: Me; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  };
  const { newLeads, unread } = useBadges();
  const { collapsed, setCollapsed, toggle } = useRailCollapsed(RAIL_STORAGE_KEY);
  const { out, go, stage, onClickCapture } = usePageTransition({ countSelector: COUNT_SELECTOR });
  const [crumb, setCrumb] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);

  const idx = Math.max(0, RAIL.findIndex((r) => isOn(path, r.match)));
  const activeKnown = RAIL.some((r) => isOn(path, r.match));
  const accountName = me.customer.displayName;
  const kind = CUSTOMER_KIND[me.customer.kind];
  const badge = (b?: Item["badge"]) => (b === "leads" ? newLeads : b === "unread" ? unread : 0);

  // keyboard: [ toggles the rail, 1-6 jump to sections, / focuses search (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "[") {
        e.preventDefault();
        toggle();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        search.current?.focus();
        return;
      }
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= 6 && document.querySelector(".modal") === null) go(RAIL[n - 1].href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, toggle]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = search.current?.value.trim() ?? "";
    go(q ? `/leads?q=${encodeURIComponent(q)}` : "/leads");
  };

  return (
    <CrumbCtx.Provider value={setCrumb}>
      <div className="shell" onClickCapture={onClickCapture}>
        <aside className="rail" aria-label="Main menu">
          <Link href="/dashboard" className="rb" aria-label="LEADS home">
            <LogoMark size={38} />
            <span className="lbl2">leads</span>
          </Link>
          <nav className="rnav" aria-label="Sections">
            {activeKnown && <span className="ind" aria-hidden="true" style={{ transform: `translateY(${idx * 50}px)` }} />}
            {RAIL.map((r, i) => {
              const on = activeKnown && i === idx;
              const n = badge(r.badge);
              return (
                <Link key={r.key} href={r.href} className={`ri ${on ? "on" : ""}`} aria-current={on ? "page" : undefined} aria-label={n > 0 ? `${r.label}, ${n} new` : r.label}>
                  <Icon name={r.icon} size={21} />
                  <span className={`pip ${n > 0 ? "has" : ""}`} />
                  <span className="lbl2">{r.label}</span>
                  {n > 0 && <span className="bdg lbl2">{n}</span>}
                  <span className="tip" aria-hidden="true">
                    {r.label}
                    {n > 0 && <b>{n}</b>}
                  </span>
                </Link>
              );
            })}
          </nav>
          {activeKnown && <span className="notch" aria-hidden="true" style={{ transform: `translateY(${70 + idx * 50}px)` }} />}
          <div className="rsep" />
          <Link href="/listings/new" className="radd" aria-label="Add listing">
            <Icon name="plus" size={21} />
            <span className="lbl2">Add listing</span>
            <span className="tip" aria-hidden="true">
              Add listing
            </span>
          </Link>
          <div className="rfoot">
            <button type="button" className="ri rcol" aria-label={collapsed ? "Expand menu" : "Collapse menu"} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
              <Icon name="chev" size={21} />
              <span className="lbl2">Collapse</span>
              <span className="tip" aria-hidden="true">
                Expand
              </span>
            </button>
            <div className="rme-row">
              <Link href="/settings" className="rme" aria-label={`Account: ${accountName}, ${kind}`}>
                <span className="avatar">{me.customer.initials}</span>
                <span className="lbl2">
                  <b>{accountName}</b>
                  <small>{kind}</small>
                </span>
                <span className="tip" aria-hidden="true">
                  {accountName} · {kind}
                </span>
              </Link>
              <button type="button" className="rout" aria-label="Log out" disabled={loggingOut} onClick={onLogout}>
                <Icon name="out" size={19} />
                <span className="tip" aria-hidden="true">
                  Log out
                </span>
              </button>
            </div>
          </div>
        </aside>

        <div style={{ minWidth: 0 }}>
          <header className="top2">
            <div className="crumbs">
              <small>{accountName}</small>
              <span className="cr">
                <span key={crumb ?? titleFor(path)}>{crumb ?? titleFor(path)}</span>
              </span>
            </div>
            <form role="search" className="srch-f" onSubmit={onSearch}>
              <label className="srch">
                <Icon name="search" size={17} />
                <input ref={search} type="search" placeholder="Search leads, phone, area" aria-label="Search leads" />
                <kbd aria-hidden="true">/</kbd>
              </label>
            </form>
            <Link href="/notifications" className="ibtn" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}>
              <Icon name="bell" size={19} />
              {unread > 0 && <span className="dot" />}
            </Link>
            <LampToggle />
          </header>
          <main className="content2">
            <div ref={stage} className={`stage2 ${out ? "out" : ""}`}>
              <div className="pane" key={paneKey(path)}>
                {children}
              </div>
            </div>
          </main>
        </div>

        <nav className="tabsm" aria-label="Main">
          {TABS.map((t) => {
            const on = isOn(path, t.match);
            return (
              <Link key={t.key} href={t.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
                <Icon name={t.icon} size={22} />
                {t.label}
              </Link>
            );
          })}
        </nav>
        <Ghar area="app" />
      </div>
    </CrumbCtx.Provider>
  );
}
