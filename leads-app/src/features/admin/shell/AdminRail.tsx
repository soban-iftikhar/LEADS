"use client";

import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import { activeItem, ADMIN_NAV, type AdminBadges } from "./nav";

// group row 44px + 4px gap; groups above the open one are closed, so this is exact
const GROUP_STEP = 48;

type Props = {
  path: string;
  badges: AdminBadges;
  admin: { name: string; initials: string; role: string };
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
  loggingOut: boolean;
};

export function AdminRail({ path, badges, admin, collapsed, onToggle, onLogout, loggingOut }: Props) {
  const active = activeItem(path);
  const gi = active?.group ?? -1;
  const count = (k?: keyof AdminBadges) => (k ? badges[k] : 0);

  return (
    <aside className="rail" aria-label="Admin menu">
      <Link href="/admin" className="rb" aria-label="LEADS admin, go to overview">
        <LogoMark size={38} />
        <span className="lbl">
          leads<small>ADMIN</small>
        </span>
      </Link>
      <nav className="rnav" aria-label="Admin sections">
        {gi >= 0 && <span className="ind" aria-hidden="true" style={{ transform: `translateY(${gi * GROUP_STEP}px)` }} />}
        {ADMIN_NAV.map((g, i) => {
          const open = i === gi;
          const pip = g.items.some((it) => count(it.badge) > 0);
          const items = (fly: boolean) =>
            g.items.map((it) => {
              const on = active?.item.href === it.href;
              const n = count(it.badge);
              return (
                <Link key={it.href} href={it.href} className={cx("sa", on && "on")} aria-current={on ? "page" : undefined} tabIndex={fly || open || collapsed ? undefined : -1}>
                  {it.label}
                  {n > 0 && (
                    <span className="bdg" aria-label={`${n} waiting`}>
                      {n}
                    </span>
                  )}
                </Link>
              );
            });
          return (
            <div key={g.label} className={cx("rg", open && "open")}>
              <Link href={g.items[0].href} className={cx("ri", open && "on")} aria-expanded={open} aria-label={g.label}>
                <Icon name={g.icon} size={20} strokeWidth={1.9} />
                {pip && <span className="pip" />}
                <span className="lbl">{g.label}</span>
                <svg className="chv lbl" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
              <div className="sub">
                <div>{items(false)}</div>
              </div>
              {collapsed && (
                <div className="fly">
                  <div>
                    <span className="ft">{g.label}</span>
                    {items(true)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="rfoot">
        <button type="button" className="ri rcol" aria-label={collapsed ? "Expand menu" : "Collapse menu"} aria-expanded={!collapsed} onClick={onToggle}>
          <Icon name="back" size={20} strokeWidth={1.9} />
          <span className="lbl">Collapse</span>
          <span className="tip" aria-hidden="true">
            Expand
          </span>
        </button>
        <button type="button" className="ri rout" aria-label="Log out" disabled={loggingOut} onClick={onLogout}>
          <Icon name="exit" size={20} strokeWidth={1.9} />
          <span className="lbl">Log out</span>
          <span className="tip" aria-hidden="true">
            Log out
          </span>
        </button>
        <div className="rme">
          <span className="av" aria-hidden="true">
            {admin.initials}
          </span>
          <span className="lbl">
            <b>{admin.name}</b>
            <small>{admin.role}</small>
          </span>
          <span className="tip" aria-hidden="true">
            {admin.name} · {admin.role}
          </span>
        </div>
      </div>
    </aside>
  );
}
