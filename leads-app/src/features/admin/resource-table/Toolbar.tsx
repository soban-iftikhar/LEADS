"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import { SEARCH_DEBOUNCE_MS } from "@/lib/admin/constants";
import type { ListParams, Option, ResourceConfig } from "@/lib/admin/resource";
import { formatNumber } from "@/lib/format";

type Props = { config: ResourceConfig; params: ListParams; counts: Record<string, number>; set: (patch: Partial<ListParams>) => void };

/** Status tabs with counts (plus Archived), one filter select, debounced search. */
export function Toolbar({ config, params, counts, set }: Props) {
  const tabs: Option[] = [...(config.tabs ?? []), ...(config.canArchive ? [{ value: "archived", label: "Archived" }] : [])];
  return (
    <div className="tool">
      {tabs.length > 0 && (
        <div className="seg" role="tablist" aria-label="Status">
          {tabs.map((t) => {
            const on = params.tab === t.value || (t.value === "all" && !tabs.some((x) => x.value === params.tab));
            return (
              <button key={t.value} type="button" role="tab" aria-selected={on} className={cx(on && "on")} onClick={() => set({ tab: t.value })}>
                {t.label}
                {counts[t.value] !== undefined && <span className="n">{formatNumber(counts[t.value])}</span>}
              </button>
            );
          })}
        </div>
      )}
      {config.filter && (
        <label className="fsel">
          <span>{config.filter.label}</span>
          <select value={params.filter} onChange={(e) => set({ filter: e.target.value })} aria-label={`Filter by ${config.filter.label}`}>
            <option value="all">All</option>
            {config.filter.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <SearchBox key={params.q} initial={params.q} label={config.title} onSearch={(q) => set({ q })} />
    </div>
  );
}

function SearchBox({ initial, label, onSearch }: { initial: string; label: string; onSearch: (q: string) => void }) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    // only real edits: the URL already holds `initial`
    if (value.trim() === initial) return;
    const t = setTimeout(() => onSearch(value.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // onSearch changes with every render of the parent; the debounce follows the text only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, initial]);
  return (
    <label className="fsearch">
      <Icon name="search" size={15} />
      <input type="search" placeholder="Search" value={value} onChange={(e) => setValue(e.target.value)} aria-label={`Search ${label}`} maxLength={100} />
    </label>
  );
}
