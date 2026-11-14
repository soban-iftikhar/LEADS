import type { Metadata } from "next";
import { SettingsView } from "@/components/app/Settings";
import { getMe, getNotificationSettings } from "@/lib/api";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const [me, prefs] = await Promise.all([getMe(), getNotificationSettings()]);
  return <SettingsView me={me} prefs={prefs} />;
}
