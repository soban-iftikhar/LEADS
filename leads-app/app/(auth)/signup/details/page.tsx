import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupDetails } from "@/components/auth/SignupDetails";
import { requireGuest } from "@/lib/guards";

export const metadata: Metadata = { title: "Your details", robots: { index: false } };

export default async function SignupDetailsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireGuest();
  const { type } = await searchParams;
  if (type !== "seller" && type !== "agency") redirect("/signup");
  return <SignupDetails kind={type} />;
}
