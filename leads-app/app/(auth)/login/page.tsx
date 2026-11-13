import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { requireGuest } from "@/lib/guards";
import { safeNext } from "@/lib/redirects";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

type SP = Promise<{ next?: string; reset?: string; verified?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  await requireGuest();
  const sp = await searchParams;
  const note = sp.reset === "done" ? "Password changed. Log in with the new one." : sp.verified === "email" ? "Email confirmed." : null;
  return <LoginForm next={safeNext(sp.next)} note={note} />;
}
