import type { Metadata } from "next";
import { SettingsView } from "@/components/app/Settings";
import { getCity, getMe, getNotificationSettings } from "@/lib/api";
import { activeRegions } from "@/server/modules/config/regions";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const [me, prefs] = await Promise.all([getMe(), getNotificationSettings()]);
  const owner = me.customer.kind === "SELLER";
  const [regions, city] = owner ? await Promise.all([activeRegions(), getCity()]) : [[], null];
  return <SettingsView me={me} prefs={prefs} regions={regions} city={city} />;
}
