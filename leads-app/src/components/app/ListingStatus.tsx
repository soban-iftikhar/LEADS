"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bar, Button, Chip, Icon, ListingPic, Modal, Note, Section, useToast } from "@/components/ui";
import type { IconName } from "@/components/ui/icons";
import { ApiError, listingAction } from "@/lib/api";
import { formatDate, formatDateTime, formatPkr } from "@/lib/format";
import { LISTING_STATUS } from "@/lib/labels";
import type { ListingDetail, ListingStatus, QualityCheck } from "@/types/api";

const EDITABLE: ListingStatus[] = ["DRAFT", "NEEDS_INFO", "REJECTED", "APPROVED", "PAUSED"];

const MEANINGS: [Exclude<ListingStatus, "ARCHIVED">, string][] = [
  ["DRAFT", "Not sent yet. Only you can see it."],
  ["UNDER_REVIEW", "Our team is checking it. Usually done within 24 hours."],
  ["NEEDS_INFO", "We need something from you before it can go live."],
  ["APPROVED", "Approved. You can buy leads for it."],
  ["REJECTED", "Doesn't meet our rules. Fix it and send it again."],
  ["PAUSED", "You paused it. No new leads until you resume."],
  ["SOLD", "Marked sold. Any active package stops and the rest is refunded as cashback."],
];

type Step = { label: string; at: string | null; state: "ok" | "now" | "" };

function steps(l: ListingDetail): Step[] {
  const at = (s: ListingStatus) => [...l.timeline].reverse().find((t) => t.status === s)?.at ?? null;
  const submitted = l.timeline.find((t) => t.status === "UNDER_REVIEW")?.at ?? null;
  const reviewed = l.status !== "UNDER_REVIEW" && l.status !== "DRAFT";
  const last: Step =
    l.status === "NEEDS_INFO"
      ? { label: "Needs info", at: at("NEEDS_INFO"), state: "now" }
      : l.status === "REJECTED"
        ? { label: "Rejected", at: at("REJECTED"), state: "now" }
        : { label: "Live", at: at("APPROVED"), state: ["APPROVED", "PAUSED", "SOLD"].includes(l.status) ? "ok" : "" };
  const out: Step[] = [
    { label: "Submitted", at: submitted, state: submitted ? "ok" : "" },
    { label: "In review", at: submitted, state: reviewed || l.status === "UNDER_REVIEW" ? "ok" : "" },
    last,
  ];
  // a listing stuck at a problem still shows where it is heading
  if (last.state === "now") out.push({ label: "Live", at: null, state: "" });
  return out;
}

function StatusTimeline({ items, now }: { items: Step[]; now: Date }) {
  return (
    <section className="sec sec-b" aria-label="Review progress">
      <ol className="steps">
        {items.map((s) => (
          <li key={s.label} className={s.state}>
            <span className="d" aria-hidden="true">
              {s.state === "ok" && <Icon name="check" size={14} strokeWidth={3} />}
              {s.state === "now" && <Icon name="alert" size={14} strokeWidth={3} />}
            </span>
            {s.label}
            <span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>
              {s.at ? formatDate(s.at, now) : "—"}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const FIX: Record<string, { icon: IconName; title: string; action: string; anchor: string }> = {
  basics: { icon: "map", title: "Type, size or area missing", action: "Edit", anchor: "#property" },
  price: { icon: "tag", title: "Price missing", action: "Edit", anchor: "#property" },
  description: { icon: "edit", title: "Description too short", action: "Edit", anchor: "#property" },
  photos: { icon: "img", title: "Not enough photos", action: "Upload", anchor: "#photos" },
  ownership_doc: { icon: "doc", title: "Ownership document missing", action: "Upload", anchor: "#document" },
  whatsapp: { icon: "phone", title: "WhatsApp number not verified", action: "Verify", anchor: "" },
};

function FixItem({ c, listingId }: { c: QualityCheck; listingId: string }) {
  const f = FIX[c.key] ?? { icon: "alert" as IconName, title: c.label, action: "Edit", anchor: "" };
  const href = c.key === "whatsapp" ? "/settings#profile" : `/listings/${listingId}/edit${f.anchor}`;
  return (
    <div className="note warn">
      <Icon name={f.icon} size={20} />
      <div style={{ flex: "1 1 0%" }}>
        <b>{f.title}</b>
        {c.hint && <div style={{ color: "var(--ink-2)", marginTop: 2 }}>{c.hint}</div>}
      </div>
      <Link href={href} className="btn sm">
        {f.action}
      </Link>
    </div>
  );
}

function MoreMenu({ l }: { l: ListingDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  const run = async (a: "pause" | "resume" | "mark-sold") => {
    setBusy(true);
    try {
      await listingAction(l.id, a);
      toast(a === "pause" ? "Listing paused." : a === "resume" ? "Listing is live again." : "Marked sold.");
      setConfirm(false);
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't do that. Try again.");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };
  const items: { label: string; act: () => void }[] = [];
  if (l.status === "APPROVED") items.push({ label: "Pause listing", act: () => run("pause") });
  if (l.status === "PAUSED") items.push({ label: "Resume listing", act: () => run("resume") });
  if (l.status === "APPROVED" || l.status === "PAUSED") items.push({ label: "Mark as sold", act: () => { setOpen(false); setConfirm(true); } });
  if (!items.length) return null;
  return (
    <div className="acct" ref={ref}>
      <button type="button" className="mini" aria-label="More actions" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="dots" size={16} />
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          {items.map((i) => (
            <button key={i.label} type="button" role="menuitem" onClick={i.act} disabled={busy}>
              {i.label}
            </button>
          ))}
        </div>
      )}
      {confirm && (
        <Modal
          title="Mark as sold?"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button variant="ink" loading={busy} loadingLabel="Saving…" onClick={() => run("mark-sold")}>
                Mark as sold
              </Button>
            </>
          }
        >
          <p style={{ margin: 0 }}>{LISTING_STATUS.SOLD && "Marked sold. Any active package stops and the rest is refunded as cashback."}</p>
        </Modal>
      )}
    </div>
  );
}

export function ListingStatusView({ listing: l, now }: { listing: ListingDetail; now: string }) {
  const n = new Date(now);
  const chip = LISTING_STATUS[l.status as keyof typeof LISTING_STATUS];
  const failing = l.quality.checks.filter((c) => !c.passed);
  const review = [...l.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const place = [l.locality.name, l.locality.regionName].filter(Boolean).join(", ");
  const price = Number(l.pricePkr) > 0 ? (formatPkr(l.pricePkr).startsWith("PKR") ? formatPkr(l.pricePkr) : `PKR ${formatPkr(l.pricePkr)}`) : null;
  return (
    <>
      <Link href="/listings" className="lnk" style={{ color: "var(--ink-2)" }}>
        ← Listings
      </Link>
      <section className="sec sec-b between" style={{ flexWrap: "wrap" }}>
        <div className="who">
          <ListingPic kind={l.category} size={52} coverUrl={l.coverUrl} />
          <div>
            <div className="row" style={{ gap: 10 }}>
              <h1 style={{ fontSize: 22, letterSpacing: "-.02em", margin: 0, fontWeight: 700 }}>{l.title}</h1>
              {chip && <Chip tone={chip.tone}>{chip.label}</Chip>}
            </div>
            <small style={{ fontSize: 14 }}>{[place, price].filter(Boolean).join(" · ")}</small>
          </div>
        </div>
        <div className="row">
          {EDITABLE.includes(l.status) && (
            <Button href={`/listings/${l.id}/edit`} icon="edit">
              {l.status === "DRAFT" ? "Continue editing" : "Edit listing"}
            </Button>
          )}
          <MoreMenu l={l} />
        </div>
      </section>
      {l.status !== "DRAFT" && <StatusTimeline items={steps(l)} now={n} />}
      {(l.status === "NEEDS_INFO" || l.status === "REJECTED") && (
        <Section title="What to fix" action={<span className="muted" style={{ fontSize: 13 }}>{`${failing.length + (review?.note ? 0 : 0)} item${failing.length === 1 ? "" : "s"} · then it goes back to review`}</span>} bodyClassName="stack12">
          {review?.note && (
            <div className="note">
              <Icon name="msg" size={20} />
              <div style={{ flex: "1 1 0%" }}>
                <b>Note from our team</b>
                <div style={{ color: "var(--ink-2)", marginTop: 2 }}>&quot;{review.note}&quot;</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                  LEADS review team · {formatDateTime(review.createdAt, n)}
                </div>
              </div>
            </div>
          )}
          {failing.map((c) => (
            <FixItem key={c.key} c={c} listingId={l.id} />
          ))}
          {!failing.length && (
            <Note tone="y" icon="info">
              Everything we check passes now. Open the listing and send it for review again.
            </Note>
          )}
        </Section>
      )}
      {l.status === "APPROVED" && (
        <Section title="Performance" action={!l.activeOrder ? <Link href={`/packages/buy?listing=${l.id}`} className="lnk">Buy leads</Link> : undefined}>
          <dl className="dl">
            <dt>Leads delivered</dt>
            <dd className="mono">{l.leadCount}</dd>
            <dt>Active package</dt>
            <dd>
              {l.activeOrder ? (
                <div style={{ maxWidth: 280 }}>
                  <div className="between" style={{ fontSize: 13 }}>
                    <span>
                      {l.activeOrder.planName} · <b className="mono">{`${l.activeOrder.deliveredCount}/${l.activeOrder.leadCount}`}</b>
                    </span>
                    <span className="muted">{l.activeOrder.daysLeft} days left</span>
                  </div>
                  <Bar value={l.activeOrder.deliveredCount} max={l.activeOrder.leadCount} label="Delivered" className="mt6" />
                </div>
              ) : (
                <span className="muted">No package</span>
              )}
            </dd>
            <dt>Quality score</dt>
            <dd className="mono">{l.qualityScore === null ? "—" : `${l.qualityScore}%`}</dd>
          </dl>
        </Section>
      )}
      {l.status === "UNDER_REVIEW" && (
        <Note icon="clock">Our team is checking it. Usually done within 24 hours.</Note>
      )}
      <Section title="What each status means" flush>
        <div className="scroll-x">
          <table className="tbl">
            <tbody>
              {MEANINGS.map(([s, text]) => (
                <tr key={s} aria-current={s === l.status ? "true" : undefined}>
                  <td style={{ width: 160 }}>
                    <Chip tone={LISTING_STATUS[s].tone}>{LISTING_STATUS[s].label}</Chip>
                  </td>
                  <td>{text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
