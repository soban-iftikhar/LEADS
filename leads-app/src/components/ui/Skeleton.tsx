import type { CSSProperties } from "react";

/** Grey block at the final size of what it stands in for, so nothing shifts when data lands. */
export function Skeleton({ w = "100%", h = 14, style }: { w?: number | string; h?: number | string; style?: CSSProperties }) {
  return <span className="skel" aria-hidden="true" style={{ width: w, height: h, ...style }} />;
}
