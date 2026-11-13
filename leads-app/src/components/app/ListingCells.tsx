import Link from "next/link";
import { Bar } from "@/components/ui/Bar";
import { ListingPic } from "@/components/ui/ListingPic";
import type { ListingCard } from "@/types/api";

export function PropertyCell({ l, hot, size = 40 }: { l: ListingCard; hot?: boolean; size?: number }) {
  return (
    <div className="who">
      <ListingPic kind={l.category} hot={hot} size={size} coverUrl={l.coverUrl} />
      <div style={{ minWidth: 0 }}>
        <b>{l.title}</b>
        <small>{[l.locality.name, l.locality.regionName].filter(Boolean).join(", ") || "Area not set"}</small>
      </div>
    </div>
  );
}

/** "Growth · 64/100 · 23 days" + bar; "Buy leads" for live listings without a package; else a dash. */
export function PackageCell({ l }: { l: ListingCard }) {
  if (l.activeOrder) {
    const o = l.activeOrder;
    return (
      <div style={{ minWidth: 150 }}>
        <div className="between" style={{ fontSize: 12.5 }}>
          <span>
            {o.planName} · <b className="mono">{`${o.deliveredCount}/${o.leadCount}`}</b>
          </span>
          <span className="muted">{o.daysLeft} days</span>
        </div>
        <Bar value={o.deliveredCount} max={o.leadCount} label={`${o.planName} package delivered`} className="mt6" />
      </div>
    );
  }
  if (l.status === "APPROVED") {
    return (
      <Link href={`/packages/buy?listing=${l.id}`} className="lnk" style={{ fontSize: 13.5 }}>
        Buy leads
      </Link>
    );
  }
  return <span className="muted">—</span>;
}

/** Row action by status (Overview). */
export function ListingAction({ l }: { l: ListingCard }) {
  switch (l.status) {
    case "NEEDS_INFO":
      return (
        <Link href={`/listings/${l.id}`} className="btn sm">
          Add document
        </Link>
      );
    case "REJECTED":
      return (
        <Link href={`/listings/${l.id}/edit`} className="btn sm">
          Fix
        </Link>
      );
    case "UNDER_REVIEW":
      return <span className="muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>Within 24 h</span>;
    default:
      return (
        <Link href={`/listings/${l.id}`} className="btn sm ghost">
          Open
        </Link>
      );
  }
}

/** The listing with most leads gets the yellow pictogram. */
export function hotId(items: ListingCard[]): string | null {
  const best = [...items].sort((a, b) => b.leadCount - a.leadCount)[0];
  return best && best.leadCount > 0 ? best.id : null;
}
