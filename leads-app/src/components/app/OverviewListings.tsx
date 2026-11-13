"use client";

import { Chip } from "@/components/ui/Chip";
import { DataTable } from "@/components/ui/DataTable";
import { LISTING_STATUS } from "@/lib/labels";
import type { ListingCard } from "@/types/api";
import { hotId, ListingAction, PackageCell, PropertyCell } from "./ListingCells";

export function OverviewListings({ items }: { items: ListingCard[] }) {
  const hot = hotId(items);
  return (
    <DataTable
      caption="Listings"
      rows={items.filter((l) => l.status !== "ARCHIVED")}
      rowKey={(l) => l.id}
      rowHref={(l) => `/listings/${l.id}`}
      columns={[
        { key: "p", header: "Property", cell: (l) => <PropertyCell l={l} hot={l.id === hot} /> },
        {
          key: "s",
          header: "Status",
          cell: (l) => {
            const c = LISTING_STATUS[l.status as keyof typeof LISTING_STATUS];
            return c ? <Chip tone={c.tone}>{c.label}</Chip> : null;
          },
        },
        { key: "pk", header: "Package", cell: (l) => <PackageCell l={l} /> },
        { key: "n", header: "Leads", className: "num", cell: (l) => (l.leadCount > 0 ? l.leadCount : "—") },
        { key: "a", header: "", srHeader: "Action", className: "r", cell: (l) => <ListingAction l={l} /> },
      ]}
    />
  );
}
