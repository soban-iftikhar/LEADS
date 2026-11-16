import { headers } from "next/headers";
import { AppTopBar, MobileTabBar } from "@/components/app/AppTopBar";
import { BadgeProvider } from "@/components/app/badges";
import { Ghar } from "@/components/app/Ghar";
import { ToastProvider } from "@/components/ui/Toast";
import { requireCustomer } from "@/lib/guards";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const me = await requireCustomer(h.get("x-leads-path") ?? "/dashboard");
  return (
    <div className="app-ui">
      <ToastProvider>
        <BadgeProvider newLeads={me.counts.newLeads} unread={me.counts.unreadNotifications}>
          <AppTopBar me={me} />
          <main className="content">{children}</main>
          <MobileTabBar />
          <Ghar area="app" />
        </BadgeProvider>
      </ToastProvider>
    </div>
  );
}
