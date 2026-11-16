import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { requireGuest } from "@/lib/guards";
import { safeNext } from "@/lib/redirects";
import { googleEnabled } from "@/server/auth/google";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

type SP = Promise<{ next?: string; reset?: string; verified?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  await requireGuest();
  const sp = await searchParams;
  const note = sp.reset === "done" ? "Password changed. Log in with the new one." : sp.verified === "email" ? "Email confirmed." : null;
  const error = sp.error === "google" ? "Google sign-in didn't work. Try again, or use your email." : null;
  return <LoginForm next={safeNext(sp.next)} note={note} error={error} google={googleEnabled()} />;
}
