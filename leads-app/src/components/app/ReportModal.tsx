"use client";

import { useState } from "react";
import { Button, Icon, Modal, RadioCard } from "@/components/ui";
import { ApiError, reportLead } from "@/lib/api";
import { REPORT_REASONS } from "@/lib/labels";
import type { LeadDetail, ReportReason } from "@/types/api";

export function ReportModal({ lead, onClose, onDone }: { lead: LeadDetail; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setErr("");
    try {
      await reportLead(lead.id, reason, details.trim() || undefined);
      onDone();
    } catch (e) {
      setBusy(false);
      setErr(e instanceof ApiError ? e.message : "Couldn't send the report. Try again.");
    }
  };

  return (
    <Modal
      title="Report a bad lead"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ink" disabled={!reason} loading={busy} loadingLabel="Sending…" onClick={send}>
            Send report
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: "0 0 6px", color: "var(--ink-2)" }}>{`${lead.buyerName} · ${lead.listing.title}, ${lead.listing.localityName}`}</p>
        <span className="lbl" id="rep-why" style={{ margin: 0 }}>
          What went wrong?
        </span>
        <div role="radiogroup" aria-labelledby="rep-why" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {REPORT_REASONS.map((r) => (
            <RadioCard key={r.value} name="reason" value={r.value} checked={reason === r.value} onChange={(v) => setReason(v as ReportReason)}>
              {r.label}
            </RadioCard>
          ))}
        </div>
        <label htmlFor="rep-d" className="lbl" style={{ margin: "8px 0 0" }}>
          Details <span className="muted" style={{ fontWeight: 500 }}>(optional)</span>
        </label>
        <textarea id="rep-d" className="ta" placeholder="e.g. He said he never got our message" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
        <div className="note">
          <Icon name="info" size={20} />
          <span>We check within 48 hours. If we agree, the lead goes back into your package.</span>
        </div>
        {err && (
          <div className="etx" role="alert">
            <Icon name="alert" size={15} />
            {err}
          </div>
        )}
      </div>
    </Modal>
  );
}
