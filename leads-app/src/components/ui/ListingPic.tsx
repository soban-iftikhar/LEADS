import { cx } from "./cx";

type Kind = "HOUSE" | "PLOT" | "FLAT" | "COMMERCIAL";

/** Outlined house or plot-with-flag. Shows the cover photo instead once there is one. */
export function ListingPic({ kind, hot, size = 46, coverUrl }: { kind: Kind; hot?: boolean; size?: number; coverUrl?: string | null }) {
  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URLs are already sized; next/image adds nothing here
      <img className="pic pic-photo" src={coverUrl} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: "cover" }} />
    );
  }
  return (
    <span className={cx("pic", kind === "PLOT" ? "plot" : "house", hot && "hot")} aria-hidden="true" style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" width="100%" height="100%">
        <g className="ph">
          <path d="M9 23 24 11l15 12z" className="rf" />
          <rect x="13.5" y="21" width="21" height="17" rx="3" className="bd" />
          <rect x="21.5" y="28.5" width="5" height="9.5" rx="1.2" className="dr" />
          <rect x="16.5" y="24.5" width="4" height="4" rx="1" className="wn" />
          <rect x="27.5" y="24.5" width="4" height="4" rx="1" className="wn" />
        </g>
        <g className="pp">
          <path d="M8 33 24 25l16 8-16 8z" className="ln" />
          <path d="M24 30V12" className="pl" />
          <path d="M24 12h11l-3 4 3 4H24" className="fg" />
        </g>
      </svg>
    </span>
  );
}
