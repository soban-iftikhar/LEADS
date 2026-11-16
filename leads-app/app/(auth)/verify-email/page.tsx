import type { Metadata } from "next";
import { VerifyEmail } from "@/components/auth/VerifyEmail";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Confirming your email", robots: { index: false } };

/** Callback from the verification email: /verify-email?token=<raw>. */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token }, me] = await Promise.all([searchParams, getViewer()]);
  return <VerifyEmail token={token ?? ""} signedIn={!!me} />;
}
