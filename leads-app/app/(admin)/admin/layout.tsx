import type { Metadata } from "next";
import { headers } from "next/headers";
import { ToastProvider } from "@/components/ui/Toast";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { getAdminBadges } from "@/features/admin/shell/queries";
import { requireAdmin } from "@/server/pages";

export const metadata: Metadata = { title: { default: "Admin | LEADS", template: "%s · Admin | LEADS" }, robots: { index: false, follow: false } };

// server: role check, then the shell. Every server action checks the role again on its own.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const { admin } = await requireAdmin(h.get("x-leads-path") ?? "/admin");
  const badges = await getAdminBadges();
  return (
    <div className="adm">
      <ToastProvider duration={4500}>
        <AdminShell admin={{ name: admin.name, initials: admin.initials, role: "Admin" }} badges={badges}>
          {children}
        </AdminShell>
      </ToastProvider>
    </div>
  );
}
