import { headers } from "next/headers";
import { AppShell } from "@/components/app/AppShell";
import { BadgeProvider } from "@/components/app/badges";
import { ToastProvider } from "@/components/ui/Toast";
import { requireCustomer } from "@/server/pages";

// (app): floating left rail + slim header + page transition + mobile tab bar + Ghar (ROUTES.md §3)
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const { me } = await requireCustomer(h.get("x-leads-path") ?? "/dashboard");
  return (
    <div className="app-ui">
      <ToastProvider>
        <BadgeProvider newLeads={me.counts.newLeads} unread={me.counts.unreadNotifications}>
          <AppShell me={me}>{children}</AppShell>
        </BadgeProvider>
      </ToastProvider>
    </div>
  );
}
