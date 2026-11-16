"use client";

import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { DataTable } from "@/components/ui/DataTable";
import { formatDate, formatPkr } from "@/lib/format";
import { LISTING_STATUS } from "@/lib/labels";
import type { ListingCard } from "@/types/api";
import { hotId, PropertyCell } from "./ListingCells";

function RowAction({ l }: { l: ListingCard }) {
  const btn = (href: string, label: string, ghost = true) => (
    <Link href={href} className={`btn sm ${ghost ? "ghost" : ""}`}>
      {label}
    </Link>
  );
  switch (l.status) {
    case "NEEDS_INFO":
      return btn(`/listings/${l.id}`, "Add document", false);
    case "REJECTED":
      return btn(`/listings/${l.id}/edit`, "Fix", false);
    case "UNDER_REVIEW":
    case "SOLD":
      return btn(`/listings/${l.id}`, "View");
    default:
      return btn(`/listings/${l.id}/edit`, "Edit");
  }
}

export function ListingsTable({ items, now }: { items: ListingCard[]; now: string }) {
  const hot = hotId(items);
  const n = new Date(now);
  return (
    <DataTable
      caption="Your listings"
      rows={items}
      rowKey={(l) => l.id}
      rowHref={(l) => `/listings/${l.id}`}
      columns={[
        { key: "p", header: "Property", cell: (l) => <PropertyCell l={l} hot={l.id === hot} size={44} /> },
        { key: "pr", header: "Price", className: "mono", cell: (l) => (Number(l.pricePkr) > 0 ? (formatPkr(l.pricePkr).startsWith("PKR") ? formatPkr(l.pricePkr) : `PKR ${formatPkr(l.pricePkr)}`) : "—") },
        {
          key: "s",
          header: "Status",
          cell: (l) => {
            const c = LISTING_STATUS[l.status as keyof typeof LISTING_STATUS];
            return c ? <Chip tone={c.tone}>{c.label}</Chip> : null;
          },
        },
        {
          key: "q",
          header: "Quality",
          cell: (l) =>
            l.qualityScore === null ? (
              <span className="muted">—</span>
            ) : (
              <span className="mono" style={{ color: l.qualityScore < 85 ? "var(--err)" : "var(--ink)", fontWeight: 700 }}>
                {l.qualityScore}%
              </span>
            ),
        },
        { key: "n", header: "Leads", className: "num", cell: (l) => (l.leadCount > 0 ? l.leadCount : "—") },
        { key: "d", header: "Added", cell: (l) => <span className="muted">{formatDate(l.createdAt, n)}</span> },
        { key: "a", header: "", srHeader: "Action", className: "r", cell: (l) => <RowAction l={l} /> },
      ]}
    />
  );
}
