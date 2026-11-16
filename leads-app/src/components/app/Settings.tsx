"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, Icon, Modal, Section, Switch, TextInput, useToast } from "@/components/ui";
import { ApiError, changePassword, deleteAccount, setNotificationSettings, updateMe } from "@/lib/api";
import { CUSTOMER_KIND } from "@/lib/labels";
import type { Me, NotificationSettings } from "@/types/api";
import { PageHeader } from "./PageHeader";

const PREFS: { key: keyof NotificationSettings; label: string; sub: string }[] = [
  { key: "newLeadWhatsapp", label: "New lead on WhatsApp", sub: "Get each lead the moment it arrives" },
  { key: "dailySummary", label: "Daily summary", sub: "One message at 9 am with yesterday's leads" },
  { key: "listingUpdates", label: "Listing updates", sub: "When a listing is approved or needs info" },
  { key: "emailCopies", label: "Email copies", sub: "Also send these by email" },
  { key: "packageEnding", label: "Package ending", sub: "3 days before a package ends" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "+92 300 •••4567" can't be edited back; the field starts empty with the masked number as placeholder. */
function Profile({ me }: { me: Me }) {
  const router = useRouter();
  const toast = useToast();
  const agency = me.customer.kind === "AGENCY";
  const [v, setV] = useState({ displayName: me.customer.displayName, contactPerson: me.customer.contactPerson ?? "", email: me.user.email, phone: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: string) => {
    setV((x) => ({ ...x, [k]: val }));
    setErrs((e) => ({ ...e, [k]: "" }));
  };
  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    const fe: Record<string, string> = {};
    if (v.displayName.trim().length < (agency ? 2 : 3)) fe.displayName = agency ? "What is your agency called?" : "Please enter your full name.";
    if (agency && v.contactPerson.trim().length < 3) fe.contactPerson = "Please enter your full name.";
    if (!EMAIL.test(v.email.trim())) fe.email = "Enter a valid email, like you@example.com.";
    const digits = v.phone.replace(/\D/g, "").replace(/^0/, "");
    if (v.phone && !/^3\d{9}$/.test(digits)) fe.phone = "Enter a 10-digit mobile number, like 300 1234567.";
    if (Object.values(fe).some(Boolean)) return setErrs(fe);
    setBusy(true);
    try {
      const emailChanged = v.email.trim() !== me.user.email;
      await updateMe({
        displayName: v.displayName.trim(),
        ...(agency ? { contactPerson: v.contactPerson.trim() } : {}),
        ...(emailChanged ? { email: v.email.trim() } : {}),
        ...(digits ? { phone: "0" + digits } : {}),
      });
      if (digits) {
        router.push("/signup/verify");
        return;
      }
      toast(emailChanged ? "Saved. We sent a link to confirm your new email." : "Saved.");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrs(err.errors);
      else toast("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section
      id="profile"
      title="Profile"
      action={
        <Button size="sm" variant="primary" loading={busy} loadingLabel="Saving…" onClick={() => save()}>
          Save
        </Button>
      }
    >
      <form className="fgrid" noValidate onSubmit={save}>
        <Field label={agency ? "Agency name" : "Your name"} error={errs.displayName}>
          <TextInput autoComplete={agency ? "organization" : "name"} value={v.displayName} onChange={(e) => set("displayName", e.target.value)} />
        </Field>
        {agency && (
          <Field label="Your name" error={errs.contactPerson}>
            <TextInput autoComplete="name" value={v.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
          </Field>
        )}
        <Field label="WhatsApp number" hint="Leads are sent here. Changing it asks for a new code." error={errs.phone}>
          <TextInput prefix="+92" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder={me.user.phoneMasked?.replace(/^\+92\s?/, "") ?? "300 1234567"} value={v.phone} onChange={(e) => set("phone", e.target.value.replace(/[^\d\s]/g, "").slice(0, 12))} />
        </Field>
        <Field label="Email" hint="You log in with this." error={errs.email}>
          <TextInput type="email" autoComplete="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Section>
  );
}

function Prefs({ initial }: { initial: NotificationSettings }) {
  const toast = useToast();
  const [p, setP] = useState(initial);
  const flip = async (k: keyof NotificationSettings, next: boolean) => {
    setP((x) => ({ ...x, [k]: next }));
    try {
      await setNotificationSettings({ [k]: next });
    } catch {
      setP((x) => ({ ...x, [k]: !next }));
      toast("Couldn't save that. Try again.");
    }
  };
  return (
    <Section id="notifications" title="Notifications" bodyClassName="pt6">
      {PREFS.map((r) => (
        <div key={r.key} className="between pref">
          <div>
            <div style={{ fontWeight: 600 }} id={`pref-${r.key}`}>
              {r.label}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {r.sub}
            </div>
          </div>
          <Switch checked={p[r.key]} onChange={(v) => flip(r.key, v)} label={r.label} />
        </div>
      ))}
    </Section>
  );
}

function Password() {
  const toast = useToast();
  const [v, setV] = useState({ current: "", next: "", repeat: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fe: Record<string, string> = {};
    if (!v.current) fe.current = "Enter your current password.";
    if (v.next.length < 8 || !/\d/.test(v.next)) fe.next = "Use 8 or more characters with a number.";
    if (v.repeat !== v.next) fe.repeat = "The two passwords don't match.";
    if (Object.keys(fe).length) return setErrs(fe);
    setBusy(true);
    try {
      await changePassword(v.current, v.next);
      setV({ current: "", next: "", repeat: "" });
      setErrs({});
      toast("Password changed. Other devices were logged out.");
    } catch (err) {
      if (err instanceof ApiError && err.errors?.currentPassword) setErrs({ current: err.errors.currentPassword });
      else toast("Couldn't change the password. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof v, val: string) => {
    setV((x) => ({ ...x, [k]: val }));
    setErrs((e) => ({ ...e, [k]: "" }));
  };
  return (
    <Section id="password" title="Password">
      <form noValidate onSubmit={submit}>
        <div className="fgrid">
          <Field label="Current password" error={errs.current}>
            <TextInput type="password" autoComplete="current-password" value={v.current} onChange={(e) => set("current", e.target.value)} />
          </Field>
          <div />
          <Field label="New password" error={errs.next}>
            <TextInput type="password" autoComplete="new-password" value={v.next} onChange={(e) => set("next", e.target.value)} />
          </Field>
          <Field label="Repeat new password" error={errs.repeat}>
            <TextInput type="password" autoComplete="new-password" value={v.repeat} onChange={(e) => set("repeat", e.target.value)} />
          </Field>
        </div>
        <Button type="submit" className="mt16" loading={busy} loadingLabel="Changing…">
          Change password
        </Button>
      </form>
    </Section>
  );
}

function Account({ me }: { me: Me }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const kind = CUSTOMER_KIND[me.customer.kind];
  const del = async () => {
    if (!pw) return setErr("Enter your password.");
    setBusy(true);
    setErr("");
    try {
      await deleteAccount(pw);
      router.replace("/");
      router.refresh();
    } catch (e) {
      setBusy(false);
      setErr(e instanceof ApiError ? (e.status === 409 ? "You have an active package. You can delete the account after it ends." : e.errors?.password ?? e.message) : "Couldn't delete the account. Try again.");
    }
  };
  return (
    <Section id="account" title="Account" bodyClassName="between wrap">
      <div>
        <div style={{ fontWeight: 600 }}>Account type: {kind}</div>
        <div className="muted" style={{ fontSize: 13 }}>
          Can&apos;t be changed. Contact us if you need {kind === "Agency" ? "an owner" : "an agency"} account.
        </div>
      </div>
      <Button variant="danger" icon="trash" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      {open && (
        <Modal
          title="Delete your account?"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" loading={busy} loadingLabel="Deleting…" onClick={del}>
                Delete account
              </Button>
            </>
          }
        >
          <div className="stack10">
            <p style={{ margin: 0 }}>Your listings come down and your leads are removed. This can&apos;t be undone.</p>
            <Field label="Your password" error={err}>
              <TextInput type="password" autoComplete="current-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && del()} />
            </Field>
            {!err && (
              <div className="muted" style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
                <Icon name="info" size={15} />
                Accounts with an active package can&apos;t be deleted until it ends.
              </div>
            )}
          </div>
        </Modal>
      )}
    </Section>
  );
}

export function SettingsView({ me, prefs }: { me: Me; prefs: NotificationSettings }) {
  return (
    <>
      <PageHeader title="Settings" sub={`${me.customer.displayName} · ${CUSTOMER_KIND[me.customer.kind]} account`} />
      <Profile me={me} />
      <Prefs initial={prefs} />
      <Password />
      <Account me={me} />
    </>
  );
}
