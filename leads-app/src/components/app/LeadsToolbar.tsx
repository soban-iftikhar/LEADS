"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { STAGE_FILTERS } from "@/lib/labels";
import type { LeadCounts } from "@/types/api";

type Props = {
  counts: LeadCounts;
  stage: string;
  listing: string;
  q: string;
  listings: { id: string; label: string }[];
};

/** Stage tabs, listing filter and search. Everything lives in the URL. */
export function LeadsToolbar({ counts, stage, listing, q, listings }: Props) {
  const router = useRouter();
  const path = usePathname();
  const [text, setText] = useState(q);
  const first = useRef(true);

  const href = (patch: Record<string, string>) => {
    const u = new URLSearchParams();
    const next = { stage: stage === "all" ? "" : stage, listing, q: text.trim(), ...patch };
    for (const [k, v] of Object.entries(next)) if (v) u.set(k, v);
    const s = u.toString();
    return `${path}${s ? `?${s}` : ""}`;
  };

  // search writes to the URL 300 ms after typing stops
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => router.replace(href({ q: text.trim() }), { scroll: false }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text should trigger this
  }, [text]);

  return (
    <div className="between" style={{ flexWrap: "wrap" }}>
      <Segmented
        label="Filter by status"
        value={stage}
        items={STAGE_FILTERS.map((s) => ({ value: s.value, label: s.label, count: counts[s.value], href: href({ stage: s.value === "all" ? "" : s.value }) }))}
      />
      <div className="toolbar">
        <label className="sel">
          <Icon name="home" size={16} />
          <span className="sr-only">Listing</span>
          <select value={listing} onChange={(e) => router.replace(href({ listing: e.target.value }), { scroll: false })}>
            <option value="">All listings</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <Icon name="chevd" size={16} />
        </label>
        <label className="srch2">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Name or phone" aria-label="Search leads" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      </div>
    </div>
  );
}
