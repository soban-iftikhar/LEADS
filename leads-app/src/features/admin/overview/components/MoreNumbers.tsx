"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import { formatNumber } from "@/lib/format";

export type MoreStat = { label: string; value: number; sub: string; href: string };

/** Ten secondary counts, closed by default. */
export function MoreNumbers({ stats }: { stats: MoreStat[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card">
      <button type="button" className="mbar" aria-expanded={open} aria-controls="more-numbers" onClick={() => setOpen(!open)}>
        <span>
          <b>More numbers</b>
          <small>Customers, listings, properties, contacts, campaigns</small>
        </span>
        <span className={cx("tg2", open && "open")}>
          {open ? "Hide" : `Show ${stats.length}`}
          <Icon name="chevd" size={14} strokeWidth={2.4} />
        </span>
      </button>
      <div className={cx("mg-w", open && "open")} id="more-numbers">
        <div>
          <div className="mgrid">
            {stats.map((s) => (
              <Link key={s.label} href={s.href} className="ms" tabIndex={open ? undefined : -1} aria-hidden={!open || undefined}>
                <span className="l">{s.label}</span>
                <b className="num">{formatNumber(s.value)}</b>
                <small>{s.sub}</small>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
