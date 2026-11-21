"use client";

import { useEffect, useState } from "react";
import { Button, Icon, Note } from "@/components/ui";
import { getOrder } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { OrderDetail } from "@/types/api";
import { useBadges } from "./badges";

type State = { kind: "wait" } | { kind: "ok"; order: OrderDetail; startsLater: boolean } | { kind: "failed" } | { kind: "slow" };

/** Order reference shown to the customer: "OR-" + the last 5 characters of the order id. */
const orderCode = (id: string) => `OR-${id.replace(/[^a-zA-Z0-9]/g, "").slice(-5).toUpperCase()}`;

/** C12 (screens/ag-paid.html). Polls GET /api/orders/[id] every 2 s for up to 30 s; never trusts the query. */
export function PaymentReturn({ orderId, email }: { orderId: string; email: string }) {
  const [state, setState] = useState<State>({ kind: "wait" });
  const badges = useBadges();
  useEffect(() => {
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      try {
        const o = await getOrder(orderId);
        if (o.status === "ACTIVE") {
          const startsLater = !!o.windowStartsAt && new Date(o.windowStartsAt).getTime() > Date.now() + 60_000;
          setState({ kind: "ok", order: o, startsLater });
          badges.bump({ unread: 1 });
          return;
        }
        if (o.status === "FAILED" || o.status === "CANCELLED") {
          setState({ kind: "failed" });
          return;
        }
      } catch {
        // keep polling until the time is up
      }
      if (Date.now() - started >= 30_000) setState({ kind: "slow" });
      else setTimeout(tick, 2000);
    };
    tick();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll once per order
  }, [orderId]);

  return (
    <section className="sec paid" aria-live="polite">
      <div className="sec-b">
        {state.kind === "wait" && (
          <>
            <span className="spin" aria-hidden="true" />
            <h1>Confirming your payment…</h1>
            <p>This takes a few seconds.</p>
          </>
        )}
        {state.kind === "ok" && (
          <>
            <span className="paid-tile" aria-hidden="true">
              <Icon name="check" size={36} strokeWidth={2.6} />
            </span>
            <h1>Payment received</h1>
            <p>
              {`${state.order.planName} · ${state.order.leadCount} leads for your ${state.order.listing.title} in ${state.order.listing.localityName}. `}
              {state.startsLater && state.order.windowStartsAt ? `It starts on ${formatDate(state.order.windowStartsAt)}, right after the current package ends.` : "It starts today."}
            </p>
            <Note icon="info">
              Receipt sent to {email}. Order <span className="mono">{orderCode(state.order.id)}</span>.
            </Note>
            <div className="row" style={{ marginTop: 6 }}>
              <Button href="/dashboard">Back to overview</Button>
              <Button href="/packages" variant="primary">
                See packages
              </Button>
            </div>
          </>
        )}
        {state.kind === "failed" && (
          <>
            <h1>Payment didn&apos;t go through</h1>
            <Note tone="warn" icon="alert">
              Payment didn&apos;t go through. Nothing was charged.
            </Note>
            <Button href={`/checkout/${orderId}`} variant="primary">
              Try again
            </Button>
          </>
        )}
        {state.kind === "slow" && (
          <>
            <h1>Still confirming</h1>
            <Note icon="clock">This is taking longer than usual. We&apos;ll send you a notification as soon as it&apos;s confirmed.</Note>
            <Button href="/packages">See packages</Button>
          </>
        )}
      </div>
    </section>
  );
}
