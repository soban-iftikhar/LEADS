import type { Metadata } from "next";
import { NotificationsList } from "@/components/app/NotificationsList";
import { listNotifications } from "@/server/modules/notifications/service";
import { requireCustomer } from "@/server/pages";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

const TYPES = ["lead", "listing", "package"];

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  const type = TYPES.includes(sp.type ?? "") ? sp.type : undefined;
  const { me } = await requireCustomer("/notifications");
  const first = await listNotifications(me.user.id, { type });
  return <NotificationsList key={type ?? "all"} type={type ?? "all"} initial={first} now={new Date().toISOString()} />;
}
