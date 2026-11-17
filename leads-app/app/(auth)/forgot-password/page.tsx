import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/ForgotForm";
import { requireGuest } from "@/server/pages";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default async function ForgotPage() {
  await requireGuest();
  return <ForgotForm />;
}
