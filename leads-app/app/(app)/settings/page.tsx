import type { Metadata } from "next";
import { SettingsView } from "@/components/app/Settings";
import { getPrefs } from "@/server/modules/account/service";
import { activeRegions } from "@/server/modules/catalog/service";
import { requireCustomer } from "@/server/pages";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const { me } = await requireCustomer("/settings");
  const owner = me.customer.kind === "SELLER";
  const [prefs, regions] = await Promise.all([getPrefs(me.user.id), owner ? activeRegions() : []]);
  return <SettingsView me={me} prefs={prefs} regions={regions} />;
}
