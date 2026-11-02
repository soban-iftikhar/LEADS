import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyPhone } from "@/components/auth/VerifyPhone";
import { getOtpPhone } from "@/lib/api";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Check WhatsApp", robots: { index: false } };

export default async function VerifyPage() {
  const me = await getViewer();
  if (!me) redirect(`/login?next=${encodeURIComponent("/signup/verify")}`);
  if (me.user.phoneVerified) redirect("/dashboard");
  const phone = await getOtpPhone().catch(() => me.user.phoneMasked ?? "");
  return <VerifyPhone phone={phone} kind={me.customer.kind === "AGENCY" ? "agency" : "seller"} />;
}
