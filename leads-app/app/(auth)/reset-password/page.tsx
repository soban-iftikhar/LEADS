import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/ResetForm";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

/** Callback from the reset email: /reset-password?token=<raw>. */
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetForm token={token ?? ""} />;
}
