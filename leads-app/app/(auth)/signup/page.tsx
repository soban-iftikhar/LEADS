import type { Metadata } from "next";
import { SignupType } from "@/components/auth/SignupType";
import { requireGuest } from "@/lib/guards";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireGuest();
  const { type } = await searchParams;
  return <SignupType initial={type === "agency" ? "agency" : "seller"} />;
}
