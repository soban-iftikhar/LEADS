import type { Metadata } from "next";
import { PackagesTables } from "@/components/app/PackagesTables";
import { PageHeader } from "@/components/app/PageHeader";
import { Button, Empty, Icon, Section, StatStrip } from "@/components/ui";
import { getLeads, getOrders } from "@/lib/api";

export const metadata: Metadata = { title: "Packages", robots: { index: false } };

export default async function PackagesPage() {
  const [active, past, reported] = await Promise.all([getOrders("active"), getOrders("past"), getLeads({ stage: "reported", pageSize: 1 })]);
  const t = active.totals;
  return (
    <>
      <PageHeader title="Packages" sub="One package per listing · 60 days each" actions={<Button href="/packages/buy" variant="primary">Buy leads</Button>} />
      <StatStrip
        items={[
          { label: "Active packages", value: t.activeOrders },
          { label: "Delivered", value: t.delivered, unit: `/ ${t.bought}`, bar: { value: t.delivered, max: Math.max(1, t.bought) } },
          { label: "Reports under check", value: reported.counts.reported },
          { label: "Cashback paid so far", value: t.cashbackPaidLeads, unit: "leads" },
        ]}
      />
      <Section title="Active" flush>
        {active.items.length ? (
          <PackagesTables kind="active" items={active.items} now={new Date().toISOString()} />
        ) : (
          <div className="sec-b">
            <Empty action={<Button href="/packages/buy" variant="primary" size="sm">Buy leads</Button>}>No active package. Buy leads for a live listing.</Empty>
          </div>
        )}
      </Section>
      <div className="note y">
        <Icon name="shield" size={20} />
        <span>
          <b>Cashback.</b> If a package ends with fewer leads than you bought, we refund every missing lead at the price you paid. Paid within 7 days of the end date.
        </span>
      </div>
      <Section title="Past" flush>
        {past.items.length ? (
          <PackagesTables kind="past" items={past.items} now={new Date().toISOString()} />
        ) : (
          <div className="sec-b">
            <Empty>No past packages yet.</Empty>
          </div>
        )}
      </Section>
    </>
  );
}
