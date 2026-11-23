"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import { MAX_TREND_AREAS } from "@/lib/admin/market";

type Area = { slug: string; name: string; sub: string };

/** "Areas n / 8" popover: search, tick up to eight, Top 8 / Clear / Done. Done writes ?areas=. */
export function AreaPicker({ areas, picked }: { areas: Area[]; picked: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>(picked);
  const full = sel.length >= MAX_TREND_AREAS;
  const shown = areas.filter((a) => a.name.toLowerCase().includes(q.trim().toLowerCase()));

  const close = () => {
    setOpen(false);
    const next = new URLSearchParams(sp.toString());
    next.set("areas", sel.join(","));
    if (sel.join(",") !== picked.join(",")) start(() => router.replace(`${path}?${next.toString()}`, { scroll: false }));
  };
  const toggle = (slug: string) => setSel((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : s.length < MAX_TREND_AREAS ? [...s, slug] : s));

  return (
    <div className="pickw">
      <button type="button" className="pickb" aria-expanded={open} aria-haspopup="dialog" onClick={() => (open ? close() : (setSel(picked), setOpen(true)))}>
        <Icon name="filter" size={16} />
        Areas
        <span className="n">
          {picked.length} / {MAX_TREND_AREAS}
        </span>
      </button>
      {open && (
        <>
          <div className="popscrim" onClick={close} />
          <div className="pop" role="dialog" aria-label="Pick areas" onKeyDown={(e) => e.key === "Escape" && close()}>
            <label className="inp">
              <Icon name="search" size={15} />
              <input type="search" placeholder="Search area" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search area" autoFocus />
            </label>
            <span className="hint">
              Pick up to {MAX_TREND_AREAS} · {sel.length} picked
            </span>
            <div className="plist">
              {shown.map((a) => {
                const on = sel.includes(a.slug);
                return (
                  <label key={a.slug} className={cx("pit", !on && full && "dis")}>
                    <input className="cbx" type="checkbox" checked={on} disabled={!on && full} onChange={() => toggle(a.slug)} />
                    <span>
                      {a.name}
                      <small>{a.sub}</small>
                    </span>
                  </label>
                );
              })}
              {shown.length === 0 && <div className="empty muted">No area with that name</div>}
            </div>
            <div className="pfoot">
              <button className="btn xs" type="button" onClick={() => setSel(areas.slice(0, MAX_TREND_AREAS).map((a) => a.slug))}>
                Top {MAX_TREND_AREAS}
              </button>
              <button className="btn xs quiet" type="button" onClick={() => setSel([])}>
                Clear
              </button>
              <span style={{ flex: 1 }} />
              <button className="btn xs pri" type="button" onClick={close}>
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
