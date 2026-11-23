"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cx } from "@/components/ui/cx";
import { logout } from "@/lib/api";
import { usePageTransition } from "@/lib/hooks/usePageTransition";
import { useRailCollapsed } from "@/lib/hooks/useRailCollapsed";
import { ADMIN_RAIL_STORAGE_KEY } from "@/lib/theme";
import { AdminHeader } from "./AdminHeader";
import { AdminRail } from "./AdminRail";
import type { AdminBadges } from "./nav";

const COUNT_SELECTOR = ".kpi .v, .ms b, .ny b";

type Props = { admin: { name: string; initials: string; role: string }; badges: AdminBadges; children: ReactNode };

/** Floating dark rail with sub-menus, slim header, page transition. */
export function AdminShell({ admin, badges, children }: Props) {
  const router = useRouter();
  const { collapsed, toggle } = useRailCollapsed(ADMIN_RAIL_STORAGE_KEY);
  const { path, out, go, stage, onClickCapture } = usePageTransition({ countSelector: COUNT_SELECTOR, countMs: 900, leaveMs: 170 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [askLogout, setAskLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const waiting = badges.review + badges.replies + badges.reports;

  // the mobile drawer closes on every navigation and on Esc
  const [menuPath, setMenuPath] = useState(path);
  if (menuPath !== path) {
    setMenuPath(path);
    setMenuOpen(false);
  }
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      router.replace("/admin/login");
    }
  };

  return (
    <div className={cx("shell", menuOpen && "mopen")} onClickCapture={onClickCapture}>
      <AdminRail path={path} badges={badges} admin={admin} collapsed={collapsed} onToggle={toggle} onLogout={() => setAskLogout(true)} loggingOut={loggingOut} />
      <div className="rscrim" aria-hidden="true" onClick={() => setMenuOpen(false)} />
      <div className="main">
        <AdminHeader path={path} waiting={waiting} onMenu={() => setMenuOpen(true)} go={go} />
        <main className="wrap">
          <div ref={stage} className={cx("stage", out && "out")}>
            <div className="pane" key={path}>
              {children}
            </div>
          </div>
        </main>
      </div>
      {askLogout && (
        <ConfirmDialog
          title="Log out?"
          text="You'll need your password and authenticator code to come back."
          confirmLabel="Log out"
          busy={loggingOut}
          onConfirm={onLogout}
          onCancel={() => setAskLogout(false)}
        />
      )}
    </div>
  );
}
