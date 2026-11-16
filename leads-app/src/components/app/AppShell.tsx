"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/icons";
import { CUSTOMER_KIND } from "@/lib/labels";
import { RAIL_STORAGE_KEY } from "@/lib/theme";
import type { Me } from "@/types/api";
import { useBadges } from "./badges";
import { Ghar } from "./Ghar";
import { LampToggle } from "./LampToggle";

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

// ---------------------------------------------------------------- rail state (collapsed lives on <html data-rail>)

const RAIL_EVENT = "leads-rail";
const readCollapsed = () => document.documentElement.getAttribute("data-rail") === "col";
const subscribeRail = (cb: () => void) => {
  window.addEventListener(RAIL_EVENT, cb);
  return () => window.removeEventListener(RAIL_EVENT, cb);
};

function setCollapsed(col: boolean) {
  if (col) document.documentElement.setAttribute("data-rail", "col");
  else document.documentElement.removeAttribute("data-rail");
  try {
    localStorage.setItem(RAIL_STORAGE_KEY, col ? "col" : "open");
  } catch {
    // storage blocked: the choice lasts for this page only
  }
  window.dispatchEvent(new Event(RAIL_EVENT));
}

// ---------------------------------------------------------------- count-up (PageTransition step 4)

const COUNT_SELECTOR = ".stat .v, .hero .big b, .callc .big, .hrow .v";

function countUp(root: HTMLElement | null) {
  if (!root || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  root.querySelectorAll<HTMLElement>(COUNT_SELECTOR).forEach((el) => {
    const node = el.firstChild;
    if (!node || node.nodeType !== 3) return;
    const m = (node.nodeValue ?? "").match(/^(\+?)(\d+)([\s\S]*)$/);
    if (!m) return;
    const end = Number(m[2]);
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 800);
      const e = 1 - Math.pow(1 - p, 3);
      node.nodeValue = m[1] + Math.round(end * e) + m[3];
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// ---------------------------------------------------------------- the shell

export function AppShell({ me, children }: { me: Me; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { newLeads, unread } = useBadges();
  const collapsed = useSyncExternalStore(subscribeRail, readCollapsed, () => false);
  // the path we are leaving; the page is faded out only while we are still on it
  const [leaving, setLeaving] = useState<string | null>(null);
  const out = leaving === path;
  const [crumb, setCrumb] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const idx = Math.max(0, RAIL.findIndex((r) => isOn(path, r.match)));
  const activeKnown = RAIL.some((r) => isOn(path, r.match));
  const accountName = me.customer.displayName;
  const kind = CUSTOMER_KIND[me.customer.kind];
  const badge = (b?: Item["badge"]) => (b === "leads" ? newLeads : b === "unread" ? unread : 0);

  /** Leave (190 ms blur-fade), then swap the route; the new page's blocks rise in (CSS on .pane). */
  const go = useCallback(
    (href: string) => {
      const target = new URL(href, window.location.href);
      if (target.pathname === window.location.pathname) {
        router.push(target.pathname + target.search + target.hash);
        return;
      }
      if (busy.current) return;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        router.push(href);
        return;
      }
      busy.current = true;
      setLeaving(window.location.pathname);
      timer.current = setTimeout(() => router.push(href), 190);
    },
    [router],
  );

  // the new route has rendered: show it, scroll up, count the numbers up
  useEffect(() => {
    busy.current = false;
    if (timer.current) clearTimeout(timer.current);
    window.scrollTo({ top: 0 });
    const r = requestAnimationFrame(() => countUp(stage.current));
    return () => cancelAnimationFrame(r);
  }, [path]);

  // every in-app link gets the transition, not just the rail (like the prototype's data-go)
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || a.target || a.hasAttribute("download")) return;
    const href = a.getAttribute("href") ?? "";
    if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/api/")) return;
    const url = new URL(href, window.location.href);
    if (url.pathname === window.location.pathname) return; // filters and anchors: let Link handle it
    e.preventDefault();
    go(href);
  };

  // keyboard: [ toggles the rail, 1-6 jump to sections, / focuses search (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "[") {
        e.preventDefault();
        setCollapsed(!readCollapsed());
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
  }, [go]);

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
            <svg width="38" height="38" viewBox="0 0 48 48" aria-hidden="true">
              <rect width="48" height="48" rx="13" style={{ fill: "var(--m)" }} />
              <path d="M11 19.5 17.5 13 24 19.5V31h13v6H11z" style={{ fill: "var(--on-m)" }} />
              <circle cx="32" cy="20" r="5" style={{ fill: "var(--m-tint)" }} />
            </svg>
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
