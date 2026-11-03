"use client";

import { useEffect, useState } from "react";
import { Button, Icon, Note } from "@/components/ui";
import { getOrder } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { OrderDetail } from "@/types/api";
import { useBadges } from "./badges";

type State = { kind: "wait" } | { kind: "ok"; order: OrderDetail; start: string } | { kind: "failed" } | { kind: "slow" };

/** Polls GET /api/orders/[id] every 2 s for up to 30 s. */
export function PaymentReturn({ orderId }: { orderId: string }) {
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
          const start = o.windowStartsAt && new Date(o.windowStartsAt).getTime() > Date.now() + 60_000 ? formatDate(o.windowStartsAt) : "today";
          setState({ kind: "ok", order: o, start });
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
    <div className="result">
      <section className="sec sec-b result-card" aria-live="polite">
        {state.kind === "wait" && (
          <div className="row" style={{ justifyContent: "center", gap: 12 }}>
            <span className="spin" aria-hidden="true" />
            <h1 className="rt">Confirming your payment…</h1>
          </div>
        )}
        {state.kind === "ok" && (
          <>
            <span className="done-tile" aria-hidden="true">
              <Icon name="check" size={34} strokeWidth={3} />
            </span>
            <h1 className="rt">Payment received</h1>
            <p className="muted" style={{ margin: 0 }}>
              {`${state.order.planName} · ${state.order.leadCount} leads for ${state.order.listing.title} starts ${state.start}.`}
            </p>
            <Button href="/packages" variant="primary">
              Go to packages
            </Button>
          </>
        )}
        {state.kind === "failed" && (
          <>
            <h1 className="rt">Payment didn&apos;t go through</h1>
            <Note tone="warn" icon="alert">
              Nothing was charged. You can try again with the same or another method.
            </Note>
            <Button href={`/checkout/${orderId}`} variant="primary">
              Try again
            </Button>
          </>
        )}
        {state.kind === "slow" && (
          <>
            <h1 className="rt">Still confirming</h1>
            <Note icon="clock">This is taking longer than usual. We&apos;ll send you a notification as soon as it&apos;s confirmed.</Note>
            <Button href="/packages">Go to packages</Button>
          </>
        )}
      </section>
    </div>
  );
}
