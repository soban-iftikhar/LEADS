"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { logout } from "@/lib/api";
import { CUSTOMER_KIND } from "@/lib/labels";
import type { Me } from "@/types/api";
import { LampToggle } from "./LampToggle";
import { useBadges } from "./badges";

const NAV = [
  { label: "Overview", href: "/dashboard", match: ["/dashboard"] },
  { label: "Leads", href: "/leads", match: ["/leads"], badge: true },
  { label: "Listings", href: "/listings", match: ["/listings"] },
  { label: "Package", href: "/packages", match: ["/packages", "/checkout"] },
];

export const isActive = (path: string, match: string[]) => match.some((m) => path === m || path.startsWith(m + "/"));

function AccountMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const doLogout = async () => {
    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };
  const active = isActive(path, ["/settings", "/notifications"]);
  return (
    <div className="acct" ref={ref}>
      <button type="button" className={`me ${active ? "on" : ""}`} aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${me.customer.displayName}`} onClick={() => setOpen((o) => !o)}>
        <span className="avatar">{me.customer.initials}</span>
        <span className="hide-m" style={{ lineHeight: 1.2, textAlign: "left" }}>
          <b style={{ fontSize: 13.5, display: "block" }}>{me.customer.displayName}</b>
          <small className="muted" style={{ fontSize: 12 }}>
            {CUSTOMER_KIND[me.customer.kind]}
          </small>
        </span>
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)}>
            <Icon name="gear" size={16} />
            Settings
          </Link>
          <button role="menuitem" type="button" onClick={doLogout}>
            <Icon name="out" size={16} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppTopBar({ me }: { me: Me }) {
  const path = usePathname();
  const { newLeads, unread } = useBadges();
  return (
    <header className="top">
      <div className="topin">
        <Link href="/dashboard" className="brand" aria-label="LEADS home">
          <svg width="38" height="38" viewBox="0 0 48 48" aria-hidden="true">
            <rect width="48" height="48" rx="13" style={{ fill: "var(--m)" }} />
            <path d="M11 19.5 17.5 13 24 19.5V31h13v6H11z" style={{ fill: "var(--on-m)" }} />
            <circle cx="32" cy="20" r="5" style={{ fill: "var(--m-tint)" }} />
          </svg>
          <span>leads</span>
        </Link>
        <nav className="tnav" aria-label="Main">
          {NAV.map((n) => {
            const on = isActive(path, n.match);
            return (
              <Link key={n.href} href={n.href} className={`tn ${on ? "on" : ""}`} aria-current={on ? "page" : undefined}>
                {n.label}
                {n.badge && newLeads > 0 && (
                  <span className="ct" aria-label={`${newLeads} new`}>
                    {newLeads}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="tright">
          <Link href="/listings/new" className="btn m sm hide-m">
            <Icon name="plus" size={16} strokeWidth={2.6} />
            Add listing
          </Link>
          <Link href="/notifications" className="ibtn" aria-label={unread > 0 ? `Notifications, ${unread} new` : "Notifications"}>
            <Icon name="bell" size={19} />
            {unread > 0 && <span className="dot" />}
          </Link>
          <LampToggle />
          <AccountMenu me={me} />
        </div>
      </div>
    </header>
  );
}

const TABS = [
  { label: "Overview", href: "/dashboard", icon: "dash" as const, match: ["/dashboard"] },
  { label: "Leads", href: "/leads", icon: "inbox" as const, match: ["/leads"] },
  { label: "Listings", href: "/listings", icon: "home" as const, match: ["/listings"] },
  { label: "Package", href: "/packages", icon: "box" as const, match: ["/packages", "/checkout"] },
  { label: "Account", href: "/settings", icon: "user" as const, match: ["/settings", "/notifications"] },
];

export function MobileTabBar() {
  const path = usePathname();
  return (
    <nav className="tabsm" aria-label="Main">
      {TABS.map((t) => {
        const on = isActive(path, t.match);
        return (
          <Link key={t.href} href={t.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            <Icon name={t.icon} size={22} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
