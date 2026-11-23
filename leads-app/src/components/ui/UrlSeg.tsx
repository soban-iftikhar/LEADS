"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cx } from "./cx";

export type SegOption = { value: string; label: string };

type Props = { label: string; name: string; value: string; options: SegOption[]; /** URL keys reset when this one changes. */ resets?: string[] };

/** Segmented choice kept in the URL (?name=value). The page re-renders on the server. */
export function UrlSeg({ label, name, value, options, resets = [] }: Props) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const pick = (v: string) => {
    const q = new URLSearchParams(sp.toString());
    q.set(name, v);
    for (const k of resets) q.delete(k);
    start(() => router.replace(`${path}?${q.toString()}`, { scroll: false }));
  };
  return (
    <div className="seg" role="group" aria-label={label} aria-busy={pending || undefined}>
      {options.map((o) => (
        <button key={o.value} type="button" className={cx(o.value === value && "on")} aria-pressed={o.value === value} onClick={() => pick(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
