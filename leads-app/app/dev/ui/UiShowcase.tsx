"use client";

import { useState } from "react";
import { LampToggle } from "@/components/app/LampToggle";
import { Ghar } from "@/components/app/Ghar";
import {
  Avatar,
  Bar,
  Button,
  Checkbox,
  Chip,
  DataTable,
  Empty,
  Field,
  ListingPic,
  Modal,
  Note,
  RadioCard,
  Section,
  Segmented,
  Select,
  Skeleton,
  StatStrip,
  Switch,
  TextInput,
  Textarea,
  ToastProvider,
  useToast,
  type ChipTone,
} from "@/components/ui";

const TONES: ChipTone[] = ["new", "cont", "visit", "deal", "lost", "bad", "live", "review", "info", "rej", "draft", "sold"];

type Row = { id: string; name: string; phone: string; said: string; stage: ChipTone; label: string };
const ROWS: Row[] = [
  { id: "a1", name: "Bilal Ahmed", phone: "+92 300 1234567", said: '"Ji, interested. Corner hai?"', stage: "new", label: "New" },
  { id: "a2", name: "Sana Khan", phone: "+92 321 7654321", said: '"Kab dekh sakte hain?"', stage: "cont", label: "Contacted" },
];

function Panel({ theme }: { theme: "light" | "dark" }) {
  const toast = useToast();
  const [seg, setSeg] = useState<"all" | "new" | "won">("all");
  const [radio, setRadio] = useState("contacted");
  const [sw, setSw] = useState(true);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div data-theme={theme} className="app-ui" style={{ minHeight: 0, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{theme === "light" ? "Light" : "Dark"}</h2>

      <Section title="Buttons">
        <div className="row" style={{ flexWrap: "wrap" }}>
          <Button variant="primary" icon="plus">Add listing</Button>
          <Button>Secondary</Button>
          <Button variant="ink">Ink</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" size="sm">Report</Button>
          <Button variant="primary" size="lg" icon="lock">Pay PKR 50,000</Button>
          <Button variant="primary" loading={busy} loadingLabel="Logging in…" onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 1500); }}>Log in</Button>
          <Button variant="primary" disabled>Submit for review</Button>
        </div>
      </Section>

      <Section title="Chips">
        <div className="row" style={{ flexWrap: "wrap" }}>
          {TONES.map((t) => <Chip key={t} tone={t}>{t}</Chip>)}
          <Chip tone="new" dense>Dense</Chip>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="fgrid">
          <Field label="Email" hint="You log in with this."><TextInput type="email" placeholder="you@example.com" /></Field>
          <Field label="WhatsApp number" error="Enter a 10-digit mobile number, like 300 1234567."><TextInput prefix="+92" inputMode="numeric" defaultValue="300" /></Field>
          <Field label="Price"><TextInput prefix="PKR" defaultValue="2,40,00,000" className="mono" /></Field>
          <Field label="Size"><TextInput defaultValue="10" suffix="Marla" /></Field>
          <Field label="City"><Select defaultValue="islamabad"><option value="islamabad">Islamabad</option><option value="rawalpindi">Rawalpindi</option></Select></Field>
          <Field label="Your notes"><Textarea placeholder="e.g. Call after 6pm" /></Field>
        </div>
      </Section>

      <Section title="Segmented, radio, checkbox, switch">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Segmented label="Filter" value={seg} onChange={setSeg} items={[{ value: "all", label: "All", count: 64 }, { value: "new", label: "New", count: 3 }, { value: "won", label: "Won", count: 4 }]} />
          <div className="fgrid">
            {["new", "contacted"].map((v) => (
              <RadioCard key={v} name={`r-${theme}`} value={v} checked={radio === v} onChange={setRadio}>{v === "new" ? "New" : "Contacted"}</RadioCard>
            ))}
          </div>
          <div className="row"><Checkbox defaultChecked>Keep me logged in</Checkbox><Switch checked={sw} onChange={setSw} label="New lead on WhatsApp" /></div>
        </div>
      </Section>

      <StatStrip items={[
        { label: "Active packages", value: "3", sub: "See packages" },
        { label: "Leads delivered", value: "104", unit: "/ 150", bar: { value: 104, max: 150 } },
        { label: "Next package ends", value: "6 Dec", sub: "in 23 days · 10 Marla house" },
        { label: "Leads to call", value: "3", sub: "Oldest 5 hours ago" },
      ]} />

      <Section title="Table" action={<a className="lnk" href="#">All leads</a>} flush>
        <DataTable<Row>
          rows={ROWS}
          rowKey={(r) => r.id}
          columns={[
            { key: "b", header: "Buyer", cell: (r) => <div className="who"><Avatar initials={r.name.split(" ").map((p) => p[0]).join("")} tone="y" /><div style={{ minWidth: 0 }}><b>{r.name}</b><small className="mono">{r.phone}</small></div></div> },
            { key: "s", header: "What they said", cell: (r) => <span className="said">{r.said}</span> },
            { key: "st", header: "Status", cell: (r) => <Chip tone={r.stage}>{r.label}</Chip> },
          ]}
        />
      </Section>

      <Section title="Misc">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="row"><Avatar initials="BA" tone="y" /><Avatar initials="SK" tone="t" /><Avatar initials="AM" tone="k" /><Avatar initials="UF" /><Avatar initials="AN" size={56} tone="y" /></div>
          <div className="row"><ListingPic kind="HOUSE" /><ListingPic kind="PLOT" /><ListingPic kind="HOUSE" hot size={52} /></div>
          <Bar value={64} max={100} label="Delivered" />
          <Note icon="info">Leads start arriving within 48 hours.</Note>
          <Note tone="warn" icon="alert">This link has expired.</Note>
          <Note tone="y">Cashback. If a package ends with fewer leads than you bought, we refund every missing lead.</Note>
          <Empty action={<Button variant="primary" icon="plus" size="sm">Add listing</Button>}>No listings yet.</Empty>
          <div className="row"><Skeleton w={40} h={40} /><div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}><Skeleton w="40%" /><Skeleton w="25%" h={12} /></div></div>
          <div className="row"><Button onClick={() => setModal(true)}>Open modal</Button><Button onClick={() => toast("Report sent. We'll check within 48 hours.")}>Show toast</Button></div>
        </div>
      </Section>

      {modal && (
        <Modal title="Report a bad lead" onClose={() => setModal(false)} footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button><Button variant="ink">Send report</Button></>}>
          <p style={{ margin: 0 }}>Bilal Ahmed · 10 Marla house</p>
        </Modal>
      )}
    </div>
  );
}

export function UiShowcase() {
  return (
    <ToastProvider>
      <div className="app-ui">
        <header className="top">
          <div className="topin">
            <b style={{ fontSize: 18 }}>UI primitives</b>
            <div className="tright"><LampToggle /></div>
          </div>
        </header>
        <div className="devgrid">
          <Panel theme="light" />
          <Panel theme="dark" />
        </div>
        <Ghar area="app" />
      </div>
    </ToastProvider>
  );
}
