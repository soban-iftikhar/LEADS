"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Chip, Icon, Note, RadioCard, Section, useToast } from "@/components/ui";
import { toneFor } from "@/components/ui/Avatar";
import { ApiError, patchLead } from "@/lib/api";
import { formatBudget, formatDate, formatFollowUp, formatPhone, formatStamp, fromLocalInput, toLocalInput } from "@/lib/format";
import { CUSTOMER_STAGE, LEAD_SOURCE, leadChip } from "@/lib/labels";
import { telHref, waHref } from "@/lib/links";
import type { CustomerStage, LeadDetail } from "@/types/api";
import { useBadges } from "./badges";
import { ReportModal } from "./ReportModal";

const STAGES: CustomerStage[] = ["NEW", "CONTACTED", "VIEWING", "CLOSED_WON", "CLOSED_LOST"];

function leadCode(id: string) {
  const digits = id.replace(/\D/g, "");
  return `LD-${(digits.length >= 4 ? digits.slice(-5) : id.slice(-5)).toUpperCase()}`;
}

export function LeadDetailView({ lead: initial, displayName, reportOpen, now }: { lead: LeadDetail; displayName: string; reportOpen: boolean; now: string }) {
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const badges = useBadges();
  const n = new Date(now);
  const [lead, setLead] = useState(initial);
  const [note, setNote] = useState(initial.note ?? "");
  const [saved, setSaved] = useState<"" | "saving" | "saved" | "error">("");
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reported = lead.status === "REPORTED";
  const chip = leadChip(lead.customerStage, lead.status);
  const canReport = !lead.report && new Date(lead.reportableUntil).getTime() > n.getTime();

  const setStage = async (stage: CustomerStage) => {
    if (reported || stage === lead.customerStage) return;
    const prev = lead.customerStage;
    setLead((l) => ({ ...l, customerStage: stage }));
    const delta = (prev === "NEW" ? -1 : 0) + (stage === "NEW" ? 1 : 0);
    if (delta) badges.bump({ newLeads: delta });
    try {
      const fresh = await patchLead(lead.id, { customerStage: stage });
      setLead(fresh);
    } catch (e) {
      setLead((l) => ({ ...l, customerStage: prev }));
      if (delta) badges.bump({ newLeads: -delta });
      toast(e instanceof ApiError ? e.message : "Couldn't change the status. Try again.");
    }
  };

  const onNote = (v: string) => {
    setNote(v);
    setSaved("saving");
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      try {
        await patchLead(lead.id, { note: v });
        setSaved("saved");
      } catch {
        setSaved("error");
      }
    }, 800);
  };
  useEffect(() => () => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
  }, []);

  const onFollowUp = async (v: string) => {
    const iso = v ? fromLocalInput(v) : null;
    const prev = lead.followUpAt;
    setLead((l) => ({ ...l, followUpAt: iso }));
    try {
      await patchLead(lead.id, { followUpAt: iso });
    } catch {
      setLead((l) => ({ ...l, followUpAt: prev }));
      toast("Couldn't save the follow-up time.");
    }
  };

  const openReport = () => router.replace(`${path}?report=1`, { scroll: false });
  const closeReport = () => router.replace(path, { scroll: false });
  const onReported = () => {
    setLead((l) => ({ ...l, status: "REPORTED", report: { status: "OPEN", reason: "OTHER", details: null } }));
    if (lead.customerStage === "NEW") badges.bump({ newLeads: -1 });
    closeReport();
    toast("Report sent. We'll check within 48 hours.");
    router.refresh();
  };

  const isForm = lead.source === "CAMPAIGN_FORM";
  return (
    <>
      <Link href="/leads" className="lnk" style={{ display: "inline-flex", gap: 6, alignItems: "center", color: "var(--ink-2)" }}>
        ← Leads
      </Link>
      <section className="sec sec-b between" style={{ flexWrap: "wrap" }}>
        <div className="who">
          <Avatar initials={lead.initials} tone={toneFor(lead.id)} size={56} />
          <div>
            <div className="row" style={{ gap: 10 }}>
              <h1 style={{ fontSize: 22, letterSpacing: "-.02em", margin: 0, fontWeight: 700 }}>{lead.buyerName}</h1>
              <Chip tone={chip.tone}>{chip.label}</Chip>
            </div>
            <small className="mono" style={{ fontSize: 14 }}>
              {formatPhone(lead.phone)}
            </small>
            {lead.status === "REPORT_REJECTED" && (
              <div className="muted" style={{ fontSize: 13 }}>
                Report not accepted
              </div>
            )}
          </div>
        </div>
        <div className="row">
          <Button href={waHref(lead.phone, lead.buyerName, displayName, lead.listing.title, lead.listing.localityName)} target="_blank" rel="noopener" icon="chat">
            WhatsApp
          </Button>
          <Button href={telHref(lead.phone)} variant="primary" icon="phone">
            Call
          </Button>
        </div>
      </section>
      <div className="twocol">
        <div>
          <Section title="How they replied" action={<span className="muted" style={{ fontSize: 13 }}>{isForm ? "Property form" : "WhatsApp"}</span>} bodyClassName="convo">
            {lead.conversation.map((m, i) => (
              <div key={i} style={{ display: "contents" }}>
                <div className={`bub ${m.direction === "OUT" ? "us" : "them"}`}>{m.body}</div>
                <div className="bt" style={m.direction === "IN" ? { alignSelf: "flex-end" } : undefined}>
                  {m.direction === "OUT" ? "Sent" : "Replied"} {formatStamp(m.at, n)}
                </div>
              </div>
            ))}
            {isForm && <div className="bub them">Filled in the property form</div>}
          </Section>
          <Section title="Activity" bodyClassName="acts-b">
            {lead.activity.map((a, i) => (
              <div key={i} className="act">
                <span className="t">{formatStamp(a.at, n, false)}</span>
                <span>{a.text}</span>
              </div>
            ))}
          </Section>
          <Section title="Your notes" action={<span className="muted" style={{ fontSize: 13 }} aria-live="polite">{saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : saved === "error" ? "Couldn't save" : "Only you see these"}</span>} bodyClassName="grow">
            <label htmlFor="lead-note" className="sr-only">
              Your notes
            </label>
            <textarea id="lead-note" className="ta" placeholder="e.g. Called, wants to visit Saturday 4pm" value={note} maxLength={2000} onChange={(e) => onNote(e.target.value)} />
            <div className="between" style={{ marginTop: 12 }}>
              <label htmlFor="lead-fu" className="muted" style={{ fontSize: 13 }}>
                Follow up on
              </label>
              <span className="sel fu">
                <Icon name="cal" size={16} />
                <span aria-hidden="true">{lead.followUpAt ? formatFollowUp(lead.followUpAt) : "Pick a time"}</span>
                {/* native picker sits invisibly on top so the pill opens it */}
                <input id="lead-fu" type="datetime-local" value={lead.followUpAt ? toLocalInput(lead.followUpAt) : ""} onChange={(e) => onFollowUp(e.target.value)} />
              </span>
            </div>
          </Section>
        </div>
        <div>
          <Section title="Details">
            <dl className="dl">
              <dt>Listing</dt>
              <dd>
                <Link href={`/listings/${lead.listing.id}`}>{`${lead.listing.title}, ${lead.listing.localityName}`}</Link>
              </dd>
              <dt>Budget</dt>
              <dd className="mono">{lead.budgetMinPkr || lead.budgetMaxPkr ? `PKR ${formatBudget(lead.budgetMinPkr, lead.budgetMaxPkr)}` : "—"}</dd>
              <dt>Buying in</dt>
              <dd>{lead.timeline ? lead.timeline.replace(/^Buying in /, "") : "—"}</dd>
              <dt>How they came</dt>
              <dd>{LEAD_SOURCE[lead.source]}</dd>
              <dt>Package</dt>
              <dd>{lead.order ? `${lead.order.planName} · ${lead.listing.title}` : "—"}</dd>
              <dt>Received</dt>
              <dd>{formatStamp(lead.deliveredAt, n)}</dd>
              <dt>Lead ID</dt>
              <dd className="mono">{leadCode(lead.id)}</dd>
            </dl>
          </Section>
          <Section title="Status">
            <div role="radiogroup" aria-label="Status" aria-disabled={reported || undefined} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STAGES.map((s) => (
                <RadioCard key={s} name="stage" value={s} checked={lead.customerStage === s} disabled={reported} onChange={() => setStage(s)} className="radio-sm">
                  {CUSTOMER_STAGE[s].label}
                </RadioCard>
              ))}
              {reported && (
                <Note tone="y" icon="clock">
                  Under check. We&apos;ll reply within 48 hours.
                </Note>
              )}
            </div>
          </Section>
          <section className="sec sec-b">
            <div className="between">
              <div>
                <b style={{ fontSize: 14.5 }}>Something wrong with this lead?</b>
                <div className="muted" style={{ fontSize: 13 }}>
                  {lead.report ? "You reported this lead." : canReport ? "Report within 7 days" : `Reporting closed on ${formatDate(lead.reportableUntil, n)}`}
                </div>
              </div>
              {canReport && (
                <Button variant="danger" size="sm" icon="flag" onClick={openReport}>
                  Report
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>
      {reportOpen && canReport && <ReportModal lead={lead} onClose={closeReport} onDone={onReported} />}
    </>
  );
}
