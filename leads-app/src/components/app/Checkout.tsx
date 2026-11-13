"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Icon, Note, Section } from "@/components/ui";
import type { IconName } from "@/components/ui/icons";
import { ApiError, payOrder } from "@/lib/api";
import { formatDate, groupPk } from "@/lib/format";
import type { OrderDetail, PaymentMethod } from "@/types/api";

const METHODS: { value: PaymentMethod; label: string; meta: string; icon: IconName }[] = [
  { value: "CARD", label: "Debit or credit card", meta: "Visa, Mastercard", icon: "card" },
  { value: "JAZZCASH", label: "JazzCash", meta: "Mobile wallet", icon: "wallet" },
  { value: "EASYPAISA", label: "Easypaisa", meta: "Mobile wallet", icon: "wallet" },
  { value: "BANK_TRANSFER", label: "Bank transfer", meta: "Confirmed in 1 working day", icon: "bank" },
];

type Instructions = { bank: string; accountTitle: string; iban: string; reference: string };

export function Checkout({ order, cancelled, now }: { order: OrderDetail; cancelled: boolean; now: string }) {
  const router = useRouter();
  const n = new Date(now);
  const [method, setMethod] = useState<PaymentMethod>("CARD");
  const [agree, setAgree] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState("");
  const [bank, setBank] = useState<Instructions | null>(null);
  const startsLater = new Date(order.startsAt).getTime() > n.getTime() + 60_000;
  const total = `PKR ${groupPk(order.pricePkr)}`;

  const pay = async () => {
    if (busy || !agree) return;
    setBusy(true);
    setBanner("");
    try {
      const r = await payOrder(order.id, method);
      if ("instructions" in r) {
        setBank(r.instructions);
        setBusy(false);
        return;
      }
      // hosted payment page; the provider brings them back to /checkout/<id>/return
      if (r.redirectUrl.startsWith("/")) router.push(r.redirectUrl);
      else window.location.assign(r.redirectUrl);
    } catch (e) {
      setBusy(false);
      setBanner(e instanceof ApiError ? e.message : "Payment didn't start. Try again.");
    }
  };

  return (
    <>
      <Link href={`/packages/buy?listing=${order.listing.id}`} className="lnk" style={{ color: "var(--ink-2)" }}>
        ← Buy leads
      </Link>
      <div className="ph">
        <div>
          <h1>Payment</h1>
          <p>{`${order.planName} package · ${order.leadCount} leads`}</p>
        </div>
      </div>
      {cancelled && !banner && <Note icon="info">Payment cancelled. You can try again.</Note>}
      {banner && (
        <Note tone="warn" icon="alert" role="alert">
          {banner}
        </Note>
      )}
      <div className="twocol2">
        <div>
          <Section title="Pay with" bodyClassName="stack10">
            {bank ? (
              <>
                <Note tone="y" icon="bank">
                  Send <b className="mono">{total}</b> to this account and use the reference so we can match it. We&apos;ll confirm within 1 working day.
                </Note>
                <dl className="dl">
                  <dt>Bank</dt>
                  <dd>{bank.bank}</dd>
                  <dt>Account title</dt>
                  <dd>{bank.accountTitle}</dd>
                  <dt>IBAN</dt>
                  <dd className="mono">{bank.iban}</dd>
                  <dt>Reference</dt>
                  <dd className="mono">{bank.reference}</dd>
                </dl>
                <div>
                  <Button href="/packages">Go to packages</Button>
                </div>
              </>
            ) : (
              <div role="radiogroup" aria-label="Payment method" className="stack10">
                {METHODS.map((m) => (
                  <label key={m.value} className={`radio ${method === m.value ? "on" : ""}`}>
                    <input type="radio" name="method" className="sr-only" checked={method === m.value} onChange={() => setMethod(m.value)} />
                    <span className="rd" aria-hidden="true" />
                    <Icon name={m.icon} size={20} />
                    <span style={{ flex: "1 1 0%", fontWeight: 600 }}>{m.label}</span>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {m.meta}
                    </span>
                  </label>
                ))}
                {method !== "BANK_TRANSFER" && (
                  <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
                    You&apos;ll finish paying on the {method === "CARD" ? "bank's" : METHODS.find((x) => x.value === method)?.label} secure page.
                  </p>
                )}
              </div>
            )}
          </Section>
        </div>
        <div>
          <aside className="sec" aria-label="Order">
            <div className="sec-h">
              <h2>Order</h2>
            </div>
            <div className="sec-b grow">
              <dl className="dl" style={{ gridTemplateColumns: "1fr auto" }}>
                <dt>Listing</dt>
                <dd>{`${order.listing.title}, ${order.listing.localityName}`}</dd>
                <dt>Package</dt>
                <dd>{`${order.planName} · ${order.leadCount} leads`}</dd>
                <dt>Window</dt>
                <dd>{startsLater ? `60 days from ${formatDate(order.startsAt, n)}` : "60 days from payment"}</dd>
                <dt>Price</dt>
                <dd className="mono">{total}</dd>
                <dt>Tax</dt>
                {/* TODO(api): the order shape has no tax line yet; prices are shown as final */}
                <dd className="mono">Included</dd>
              </dl>
              <div className="divider" style={{ margin: "16px 0" }} />
              <div className="between">
                <b>Total</b>
                <b className="mono" style={{ fontSize: 20 }}>
                  {total}
                </b>
              </div>
              <label className="chk" style={{ marginTop: 16, fontSize: 13.5 }}>
                <input type="checkbox" className="sr-only chk-in" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span className="bx" aria-hidden="true">
                  <Icon name="check" size={14} strokeWidth={3.2} />
                </span>
                <span>I agree to the Terms and cashback rules</span>
              </label>
              <div className="divider" style={{ margin: "18px 0 6px" }} />
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", margin: "10px 0 4px" }}>
                What happens next
              </div>
              <div className="act">
                <span className="t">{startsLater ? formatDate(order.startsAt, n) : "Today"}</span>
                <span>Payment confirmed, package starts</span>
              </div>
              <div className="act">
                <span className="t">Within 48 h</span>
                <span>First buyers get your listing on WhatsApp</span>
              </div>
              <div className="act">
                <span className="t">Day 60</span>
                <span>Cashback for any lead we missed</span>
              </div>
              <div className="pushdown" />
              {!bank && (
                <Button variant="primary" size="lg" full icon="lock" className="mt16" disabled={!agree} loading={busy} loadingLabel="Opening payment…" onClick={pay}>
                  {`Pay ${total}`}
                </Button>
              )}
              <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0", textAlign: "center" }}>
                Leads start arriving within 48 hours.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
