"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Empty, Icon, ListingPic, Section } from "@/components/ui";
import { ApiError, createOrder } from "@/lib/api";
import { formatDate, groupPk } from "@/lib/format";
import type { ListingCard, PackagePlan } from "@/types/api";
import { hotId } from "./ListingCells";

export function BuyLeads({ listings, plans, initialListing, initialPlan, now }: { listings: ListingCard[]; plans: PackagePlan[]; initialListing?: string; initialPlan?: string; now: string }) {
  const router = useRouter();
  const n = new Date(now);
  const live = listings.filter((l) => l.status === "APPROVED");
  const [listingId, setListingId] = useState(live.find((l) => l.id === initialListing)?.id ?? live[0]?.id ?? "");
  const [planId, setPlanId] = useState(plans.find((p) => p.id === initialPlan)?.id ?? plans[1]?.id ?? plans[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState("");
  const hot = hotId(live);
  const listing = live.find((l) => l.id === listingId);
  const plan = plans.find((p) => p.id === planId);
  const starts = listing?.activeOrder ? formatDate(listing.activeOrder.windowEndsAt, n) : "today";

  const go = async () => {
    if (!listing || !plan || busy) return;
    setBusy(true);
    setBanner("");
    try {
      const { orderId } = await createOrder(listing.id, plan.id);
      router.push(`/checkout/${orderId}`);
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.status === 409 && e.errors?.orderId) {
        router.push(`/checkout/${e.errors.orderId}`);
        return;
      }
      setBanner(e instanceof ApiError ? e.message : "Couldn't start the order. Try again.");
    }
  };

  return (
    <>
      <Link href="/packages" className="lnk" style={{ color: "var(--ink-2)" }}>
        ← Packages
      </Link>
      <div className="ph">
        <div>
          <h1>Buy leads</h1>
          <p>Pay for buyers who said yes. Cashback for any we miss in 60 days.</p>
        </div>
      </div>
      {banner && (
        <div className="note warn" role="alert">
          <Icon name="alert" size={18} />
          <span>{banner}</span>
        </div>
      )}
      <Section title="1. Which listing?" action={<span className="muted" style={{ fontSize: 13 }}>Only live listings · a new package starts after the current one ends</span>}>
        {live.length ? (
          <div className="grid3" role="radiogroup" aria-label="Listing">
            {live.map((l) => (
              <label key={l.id} className={`lsel ${l.id === listingId ? "on" : ""}`}>
                <input type="radio" name="listing" className="sr-only" checked={l.id === listingId} onChange={() => setListingId(l.id)} />
                <span className={`radio ${l.id === listingId ? "on" : ""}`} style={{ padding: 0, border: 0, background: "none" }} aria-hidden="true">
                  <span className="rd" />
                </span>
                <ListingPic kind={l.category} hot={l.id === hot} size={40} coverUrl={l.coverUrl} />
                <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                  <b>{l.title}</b>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {[l.locality.name, l.locality.regionName].filter(Boolean).join(", ")}
                  </div>
                </div>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {l.activeOrder ? `Active ends ${formatDate(l.activeOrder.windowEndsAt, n)}` : "No package"}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <Empty action={<Button href="/listings/new" variant="primary" size="sm" icon="plus">Add listing</Button>}>You need a live listing first.</Empty>
        )}
      </Section>
      <Section title="2. How many leads?">
        <div className="grid3" role="radiogroup" aria-label="Package">
          {plans.map((p) => (
            <label key={p.id} className={`plan ${p.id === planId ? "on" : ""}`}>
              <input type="radio" name="plan" className="sr-only" checked={p.id === planId} onChange={() => setPlanId(p.id)} />
              <div className="between">
                <b style={{ fontSize: 16 }}>{p.name}</b>
                <span className={`radio ${p.id === planId ? "on" : ""}`} style={{ padding: 0, border: 0, background: "none" }} aria-hidden="true">
                  <span className="rd" />
                </span>
              </div>
              <div>
                <span className="n">{p.leadCount}</span> <span className="muted">leads</span>
              </div>
              <div className="mono" style={{ fontWeight: 600 }}>
                PKR {groupPk(p.pricePkr)}
              </div>
              <div className="muted" style={{ fontSize: 13.5 }}>{`PKR ${groupPk(p.pricePerLeadPkr)} per lead · ${p.deliveryDays} days`}</div>
            </label>
          ))}
        </div>
      </Section>
      <section className="sec" aria-label="Summary">
        <div className="sumbar">
          <div>
            <div className="muted" style={{ fontSize: 13 }}>
              {plan && listing ? `${plan.name} · ${plan.leadCount} leads · ${listing.title}, ${listing.locality.name} · starts ${starts}` : "Pick a listing and a package"}
            </div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", marginTop: 2 }}>
              {plan ? `PKR ${groupPk(plan.pricePkr)}` : "—"}
            </div>
          </div>
          <Button variant="primary" size="lg" disabled={!plan || !listing} loading={busy} loadingLabel="Starting…" onClick={go}>
            Continue to payment
          </Button>
        </div>
      </section>
    </>
  );
}
