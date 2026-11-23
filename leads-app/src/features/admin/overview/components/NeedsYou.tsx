"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";

export type NeedTile = { n: number; label: string; sub: string; href: string; hot?: boolean };

/** Closed by default: the total and one line; "Show" opens the five tiles. */
export function NeedsYou({ tiles }: { tiles: NeedTile[] }) {
  const [open, setOpen] = useState(false);
  const total = tiles.reduce((a, t) => a + t.n, 0);
  const summary = tiles.filter((t) => t.n > 0).map((t) => `${t.n} ${t.label.toLowerCase()}`).join(" · ") || "Nothing waiting";
  return (
    <section className="card">
      <button type="button" className="mbar" aria-expanded={open} aria-controls="needs-tiles" onClick={() => setOpen(!open)}>
        <span>
          <b>Needs you</b>
          <span className="ncount num">{total}</span>
          <small>{summary}</small>
        </span>
        <span className={cx("tg2", open && "open")}>
          {open ? "Hide" : "Show"}
          <Icon name="chevd" size={14} strokeWidth={2.4} />
        </span>
      </button>
      <div className={cx("mg-w", open && "open")} id="needs-tiles">
        <div>
          <div className="nyt">
            {tiles.map((t) => (
              <Link key={t.label} href={t.href} className={cx("card ny", t.hot && t.n > 0 && "hot")} tabIndex={open ? undefined : -1} aria-hidden={!open || undefined}>
                <Icon name="arrow" size={16} strokeWidth={2.2} className="arw" />
                <b className="num">{t.n}</b>
                <span className="t">{t.label}</span>
                <small>{t.sub}</small>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
