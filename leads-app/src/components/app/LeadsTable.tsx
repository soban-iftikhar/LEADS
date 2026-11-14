"use client";

import { Avatar, toneFor } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { formatBudget, formatPhone, formatRelative } from "@/lib/format";
import { leadChip } from "@/lib/labels";
import { telHref, waHref } from "@/lib/links";
import type { LeadListItem } from "@/types/api";

export function LeadActions({ lead, displayName }: { lead: LeadListItem; displayName: string }) {
  return (
    <div className="acts">
      <a href={telHref(lead.phone)} className="mini" aria-label={`Call ${lead.buyerName}`}>
        <Icon name="phone" size={16} />
      </a>
      <a href={waHref(lead.phone, lead.buyerName, displayName, lead.listing.title, lead.listing.localityName)} target="_blank" rel="noopener" className="mini" aria-label={`WhatsApp ${lead.buyerName}`}>
        <Icon name="chat" size={16} />
      </a>
    </div>
  );
}

export function BuyerCell({ lead }: { lead: LeadListItem }) {
  return (
    <div className="who">
      <Avatar initials={lead.initials} tone={toneFor(lead.id)} />
      <div style={{ minWidth: 0 }}>
        <b>{lead.buyerName}</b>
        <small className="mono">{formatPhone(lead.phone)}</small>
      </div>
    </div>
  );
}

/** Leads table used on Overview (no status column) and on Leads (with status). */
export function LeadsTable({ rows, displayName, withStatus, now }: { rows: LeadListItem[]; displayName: string; withStatus?: boolean; now: string }) {
  const n = new Date(now);
  const cols: Column<LeadListItem>[] = [
    { key: "buyer", header: "Buyer", cell: (l) => <BuyerCell lead={l} /> },
    { key: "listing", header: "Listing", cell: (l) => <span style={{ fontSize: 13.5 }}>{`${l.listing.title} · ${l.listing.localityName}`}</span> },
    { key: "said", header: "What they said", cell: (l) => <span className="said">{l.said ?? "—"}</span> },
    { key: "budget", header: "Budget", cell: (l) => <span className="mono" style={{ whiteSpace: "nowrap" }}>{formatBudget(l.budgetMinPkr, l.budgetMaxPkr)}</span> },
    { key: "recv", header: "Received", cell: (l) => <span className="muted" style={{ whiteSpace: "nowrap" }}>{formatRelative(l.deliveredAt, n)}</span> },
  ];
  if (withStatus) {
    cols.push({
      key: "status",
      header: "Status",
      cell: (l) => {
        const c = leadChip(l.customerStage, l.status);
        return <Chip tone={c.tone}>{c.label}</Chip>;
      },
    });
  }
  cols.push({ key: "acts", header: "", srHeader: "Actions", cell: (l) => <LeadActions lead={l} displayName={displayName} /> });
  return <DataTable rows={rows} rowKey={(l) => l.id} rowHref={(l) => `/leads/${l.id}`} columns={cols} caption="Leads" />;
}
