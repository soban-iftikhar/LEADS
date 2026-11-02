import { cx } from "./cx";

export type ChipTone = "new" | "cont" | "visit" | "deal" | "lost" | "bad" | "live" | "review" | "info" | "rej" | "draft" | "sold";

export function Chip({ tone, children, dense }: { tone: ChipTone; children: React.ReactNode; dense?: boolean }) {
  return (
    <span className={cx("chip", `c-${tone}`, dense && "dense")}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
