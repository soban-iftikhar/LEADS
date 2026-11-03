"use client";

import { Bar, Chip, DataTable, ListingPic } from "@/components/ui";
import { formatDate, formatWindow } from "@/lib/format";
import { cashbackChip, ORDER_STATUS } from "@/lib/labels";
import type { OrderCard } from "@/types/api";

const queued = (o: OrderCard, now: Date) => !!o.windowStartsAt && new Date(o.windowStartsAt).getTime() > now.getTime();

export function PackagesTables({ kind, items, now }: { kind: "active" | "past"; items: OrderCard[]; now: string }) {
  const n = new Date(now);
  const hot = [...items].sort((a, b) => b.deliveredCount - a.deliveredCount)[0]?.id;
  if (kind === "active") {
    return (
      <DataTable
        caption="Active packages"
        rows={items}
        rowKey={(o) => o.id}
        rowHref={(o) => `/listings/${o.listing.id}`}
        columns={[
          {
            key: "l",
            header: "Listing",
            cell: (o) => (
              <div className="who">
                <ListingPic kind={o.listing.category as "HOUSE"} hot={o.id === hot} size={40} />
                <div>
                  <b>{o.listing.title}</b>
                  <small>{o.listing.localityName}</small>
                </div>
              </div>
            ),
          },
          {
            key: "p",
            header: "Package",
            cell: (o) => (
              <>
                <b>{o.planName}</b> <span className="muted mono">· {o.leadCount}</span>
              </>
            ),
          },
          {
            key: "d",
            header: "Delivered",
            className: "w200",
            cell: (o) => (
              <>
                <div className="between" style={{ fontSize: 13 }}>
                  <b className="mono">{`${o.deliveredCount} / ${o.leadCount}`}</b>
                  <span className="muted">{Math.round((o.deliveredCount / o.leadCount) * 100)}%</span>
                </div>
                <Bar value={o.deliveredCount} max={o.leadCount} label="Delivered" thick className="mt6" />
              </>
            ),
          },
          { key: "w", header: "Window", cell: (o) => <span className="muted">{formatWindow(o.windowStartsAt, o.windowEndsAt, n)}</span> },
          { key: "dl", header: "Days left", className: "num", cell: (o) => (queued(o, n) ? "—" : o.daysLeft ?? "—") },
          {
            key: "s",
            header: "Status",
            cell: (o) =>
              queued(o, n) ? (
                <Chip tone="review">{`Starts ${formatDate(o.windowStartsAt as string, n)}`}</Chip>
              ) : (
                <Chip tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Chip>
              ),
          },
        ]}
      />
    );
  }
  return (
    <DataTable
      caption="Past packages"
      rows={items}
      rowKey={(o) => o.id}
      columns={[
        {
          key: "p",
          header: "Package",
          cell: (o) => (
            <>
              <b>{`${o.planName} · ${o.leadCount}`}</b>
              <div className="muted" style={{ fontSize: 12.5 }}>{`${o.listing.title}, ${o.listing.localityName}`}</div>
            </>
          ),
        },
        { key: "w", header: "Window", cell: (o) => <span className="muted">{formatWindow(o.windowStartsAt, o.windowEndsAt, n)}</span> },
        { key: "d", header: "Delivered", className: "mono", cell: (o) => `${o.deliveredCount} / ${o.leadCount}` },
        { key: "s", header: "Status", cell: (o) => <Chip tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Chip> },
        {
          key: "c",
          header: "Cashback",
          cell: (o) => {
            if (!o.cashback) return <span className="muted">—</span>;
            const c = cashbackChip(o.cashback.status, o.cashback.undeliveredCount);
            return <Chip tone={c.tone}>{c.label}</Chip>;
          },
        },
      ]}
    />
  );
}
