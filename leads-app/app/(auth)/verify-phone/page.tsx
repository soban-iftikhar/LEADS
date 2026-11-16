import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyPhoneFlow } from "@/components/auth/VerifyPhoneFlow";
import { getPendingPhone } from "@/lib/api";
import { safeNext } from "@/lib/redirects";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Your WhatsApp number", robots: { index: false } };

/** Add or change the WhatsApp number (DR-42). Query `next`: where to go afterwards. */
export default async function VerifyPhonePage({ searchParams }: { searchParams: Promise<{ next?: string; change?: string }> }) {
  const [me, sp] = await Promise.all([getViewer(), searchParams]);
  const next = safeNext(sp.next);
  if (!me) redirect(`/login?next=${encodeURIComponent(`/verify-phone?next=${next}`)}`);
  if (!me.user.emailVerified) redirect("/signup/verify");
  if (me.user.phoneVerified && sp.change !== "1") redirect(next);
  const pending = await getPendingPhone().catch(() => null);
  return <VerifyPhoneFlow pending={pending} current={me.user.phoneVerified ? me.user.phoneMasked : null} next={next} />;
}
