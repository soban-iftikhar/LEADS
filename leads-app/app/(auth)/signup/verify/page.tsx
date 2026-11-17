import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyEmailCode } from "@/components/auth/VerifyEmailCode";
import { safeNext } from "@/lib/redirects";
import { getViewer } from "@/server/pages";

export const metadata: Metadata = { title: "Check your email", robots: { index: false } };

/** Signup step 3 (DR-42): confirm the email with a 6-digit code. */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [viewer, sp] = await Promise.all([getViewer(), searchParams]);
  if (!viewer) redirect(`/login?next=${encodeURIComponent("/signup/verify")}`);
  const { me } = viewer;
  const next = safeNext(sp.next);
  if (me.user.emailVerified) redirect(next);
  return <VerifyEmailCode email={me.user.email} next={next} />;
}
